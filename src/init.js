import {adoptStyleSheets, removeExcludedStyleSheets} from './adopt';
import {updatePrototype} from './ConstructStyleSheet';
import {createObserver} from './observer';
import {
  adoptedSheetsRegistry,
  deferredDocumentStyleElements,
  deferredStyleSheets,
  frame,
  hasShadyCss,
  state,
} from './shared';
import {checkAndPrepare, isDocumentLoading} from './utils';

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
  const fragment = document.createDocumentFragment();

  for (let i = 0, len = deferredStyleSheets.length; i < len; i++) {
    deferredStyleSheets[i].disabled = false;
    fragment.appendChild(deferredStyleSheets[i]);
  }

  frame.body.appendChild(fragment);

  for (let i = 0, len = deferredDocumentStyleElements.length; i < len; i++) {
    fragment.appendChild(deferredDocumentStyleElements[i]);
  }

  document.body.insertBefore(fragment, document.body.firstChild);

  // Clear out the deferredStyleSheets array.
  deferredStyleSheets.length = 0;

  // Clear out the deferredDocumentStyleElements array.
  deferredDocumentStyleElements.length = 0;
}

export function initAdoptedStyleSheets() {
  const adoptedStyleSheetAccessors = {
    configurable: true,
    get() {
      return adoptedSheetsRegistry.get(this) || [];
    },
    set(sheets) {
      const oldSheets = adoptedSheetsRegistry.get(this) || [];
      checkAndPrepare(sheets, this);

      // If `this` is the Document, the body element should be used as a
      // location.
      const location =
        this === document
          ? // If the document is still loading the body does not exist. So the
            // document.head will be the location for a while.
            isDocumentLoading()
            ? this.head
            : this.body
          : this;

      // If the browser supports web components, it definitely supports
      // isConnected. If not, we can just check if the document contains
      // the current location.
      const isConnected =
        'isConnected' in location
          ? location.isConnected
          : document.body.contains(location);

      // Request an animation frame to let nodes connect to the DOM
      // before attempting to adopt the stylesheet(s)
      window.requestAnimationFrame(() => {
        // Element can adopt style sheets only when it is connected
        if (isConnected) {
          adoptStyleSheets(location);
          // Remove all the sheets the received array does not include.
          removeExcludedStyleSheets(location, oldSheets);
        }
      });
    },
  };

  Object.defineProperty(
    Document.prototype,
    'adoptedStyleSheets',
    adoptedStyleSheetAccessors,
  );

  if (typeof ShadowRoot !== 'undefined') {
    const {attachShadow} = HTMLElement.prototype;

    // Shadow root of each element should be observed to add styles to all
    // elements added to this root.
    HTMLElement.prototype.attachShadow = function() {
      // In case we have ShadowDOM emulation, we have to use element itself
      // instead of the ShadowRoot
      const location = hasShadyCss ? this : attachShadow.apply(this, arguments);
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
