import {adoptStyleSheets, removeExcludedStyleSheets} from './adopt';
import {updatePrototype} from './ConstructStyleSheet';
import {createObserver} from './observer';
import {
  adoptedStyleSheetsRegistry,
  deferredStyleSheets,
  frame,
  state,
} from './shared';
import {checkAndPrepare} from './utils';

// Initialize the polyfill — Will be called on the window's load event
export function initPolyfill() {
  // Iframe is necessary because to extract the native CSSStyleSheet object
  // the style element should be connected to the DOM.
  const iframe = document.createElement('iframe');
  iframe.hidden = true;
  document.body.appendChild(iframe);

  frame.body = iframe.contentWindow.document.body;
  frame.CSSStyleSheet = iframe.contentWindow.CSSStyleSheet;

  // Since we get the sheet from iframe, we need to patch prototype of the
  // CSSStyleSheet in iframe as well.
  updatePrototype(iframe.contentWindow.CSSStyleSheet.prototype);

  // Document body will be observed from the very start to catch all added
  // custom elements
  createObserver(document.body);

  // Document has loaded
  state.loaded = true;

  // Move style elements created before document.body
  // to the iframe along with future styles
  deferredStyleSheets.forEach(function(sheet) {
    frame.body.appendChild(sheet);
    sheet.disabled = false;
  });

  // Clear out the deferredStyleSheets array
  deferredStyleSheets.length = 0;
}

export function initAdoptedStyleSheets() {
  const adoptedStyleSheetAccessors = {
    configurable: true,
    get() {
      // Technically, the real adoptedStyleSheets array is placed on the body
      // element to unify the logic with ShadowRoot. However, it is hidden
      // in the WeakMap, and the public interface follows the specification.
      return adoptedStyleSheetsRegistry.get(this.body ? this.body : this) || [];
    },
    set(sheets) {
      // If `this` is the Document, the body element should be used as a
      // location.
      const location = this.body ? this.body : this;

      const oldSheets = adoptedStyleSheetsRegistry.get(location) || [];
      checkAndPrepare(sheets, location);

      // If the browser supports web components, it definitely supports
      // isConnected. If not, we can just check if the document contains
      // the current location.
      const isConnected =
        'isConnected' in location
          ? location.isConnected
          : document.contains(location);

      // Element can adopt style sheets only when it is connected
      if (isConnected) {
        adoptStyleSheets(location);
        // Remove all the sheets the received array does not include.
        removeExcludedStyleSheets(location, oldSheets);
      }
    },
  };

  Object.defineProperty(
    Document.prototype,
    'adoptedStyleSheets',
    adoptedStyleSheetAccessors,
  );

  if (typeof ShadowRoot !== 'undefined') {
    const oldAttachShadow = HTMLElement.prototype.attachShadow;

    // Shadow root of each element should be observed to add styles to all
    // elements added to this root.
    HTMLElement.prototype.attachShadow = function(...args) {
      const location = oldAttachShadow.apply(this, args);
      createObserver(location);

      return location;
    };

    Object.defineProperty(
      ShadowRoot.prototype,
      'adoptedStyleSheets',
      adoptedStyleSheetAccessors,
    );
  }
}
