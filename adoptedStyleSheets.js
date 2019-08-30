(function() {
  'use strict';

  if ('adoptedStyleSheets' in document) {
    return;
  }

  // Can we rely on document.body
  let polyfillLoaded = false;

  // Polyfill-level reference to the iframe body
  let frameBody;

  // Style elements that will be attached to the head
  // that need to be moved to the iframe
  const deferredStyleSheets = [];

  // Initialize the polyfill — Will be called on the window's load event
  function initPolyfill() {
    // Iframe is necessary because to extract the native CSSStyleSheet object
    // the style element should be connected to the DOM.
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.appendChild(iframe);

    frameBody = iframe.contentWindow.document.body;

    // Since we get the sheet from iframe, we need to patch prototype of the
    // CSSStyleSheet in iframe as well.
    updatePrototype(iframe.contentWindow.CSSStyleSheet.prototype);

    // Document body will be observed from the very start to catch all added
    // custom elements
    createObserver(document.body);

    // Document has loaded
    polyfillLoaded = true;

    // Move style elements created before document.body
    // to the iframe along with future styles
    deferredStyleSheets.forEach(nativeStyleSheet => {
      frameBody.appendChild(nativeStyleSheet);
      nativeStyleSheet.disabled = false;
    });

    // Clear out the deferredStyleSheets array
    deferredStyleSheets.length = 0;
  }

  const adoptedStyleSheetsRegistry = new WeakMap();
  const constructStyleSheetRegistry = new WeakMap();
  const locationRegistry = new WeakMap();
  const observerRegistry = new WeakMap();
  const appliedActionsCursorRegistry = new WeakMap();

  const OldCSSStyleSheet = CSSStyleSheet;

  const cssStyleSheetMethods = [
    'addImport',
    'addPageRule',
    'addRule',
    'deleteRule',
    'insertRule',
    'removeImport',
    'removeRule',
  ];

  const cssStyleSheetNewMethods = ['replace', 'replaceSync'];

  const updatePrototype = proto => {
    for (const methodKey of cssStyleSheetNewMethods) {
      proto[methodKey] = ConstructStyleSheet.prototype[methodKey];
    }

    for (const methodKey of cssStyleSheetMethods) {
      // Here we apply all changes we have done to the original CSSStyleSheet
      // object to all adopted style element.
      const oldMethod = proto[methodKey];
      proto[methodKey] = function(...args) {
        if (constructStyleSheetRegistry.has(this)) {
          const {actions, adopters} = constructStyleSheetRegistry.get(this);

          for (const [, styleElement] of adopters) {
            if (styleElement.sheet) {
              styleElement.sheet[methodKey](...args);
            }
          }

          // And we also need to remember all these changes to apply them to
          // each newly adopted style element.
          actions.push([methodKey, args]);
        }

        return oldMethod.apply(this, args);
      };
    }
  };

  const updateAdopters = sheet => {
    const {adopters, basicStyleElement} = constructStyleSheetRegistry.get(
      sheet,
    );

    for (const [, styleElement] of adopters) {
      styleElement.innerHTML = basicStyleElement.innerHTML;
    }
  };

  const importPattern = /@import/;

  // This class will be a substitute for the CSSStyleSheet class that
  // cannot be instantiated. The `new` operation will return the native
  // CSSStyleSheet object extracted from a style element appended to the
  // iframe.
  class ConstructStyleSheet {
    // Allows instanceof checks with the window.CSSStyleSheet.
    static [Symbol.hasInstance](instance) {
      return instance instanceof OldCSSStyleSheet;
    }

    constructor() {
      // A style element to extract the native CSSStyleSheet object.
      const basicStyleElement = document.createElement('style');

      if (polyfillLoaded) {
        // If the polyfill is ready, use the framebody
        frameBody.appendChild(basicStyleElement);
      } else {
        // If the polyfill is not ready, move styles to head temporarily
        document.head.appendChild(basicStyleElement);
        basicStyleElement.disabled = true;
        deferredStyleSheets.push(basicStyleElement);
      }

      const nativeStyleSheet = basicStyleElement.sheet;

      // A support object to preserve all the polyfill data
      constructStyleSheetRegistry.set(nativeStyleSheet, {
        adopters: new Map(),
        actions: [],
        basicStyleElement,
      });

      return nativeStyleSheet;
    }

    replace(contents) {
      return new Promise((resolve, reject) => {
        if (constructStyleSheetRegistry.has(this)) {
          const {basicStyleElement} = constructStyleSheetRegistry.get(this);

          basicStyleElement.innerHTML = contents;
          resolve(basicStyleElement.sheet);
          updateAdopters(this);
        } else {
          reject(
            new DOMException(
              "Failed to execute 'replace' on 'CSSStyleSheet': Can't call replace on non-constructed CSSStyleSheets.",
              'NotAllowedError',
            ),
          );
        }
      });
    }

    replaceSync(contents) {
      if (importPattern.test(contents)) {
        throw new DOMException(
          '@import rules are not allowed when creating stylesheet synchronously',
          'NotAllowedError',
        );
      }

      if (constructStyleSheetRegistry.has(this)) {
        const {basicStyleElement} = constructStyleSheetRegistry.get(this);

        basicStyleElement.innerHTML = contents;
        updateAdopters(this);

        return basicStyleElement.sheet;
      } else {
        throw new DOMException(
          "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
          'NotAllowedError',
        );
      }
    }
  }

  updatePrototype(OldCSSStyleSheet.prototype);

  const adoptStyleSheets = location => {
    const newStyles = document.createDocumentFragment();

    const sheets = adoptedStyleSheetsRegistry.get(location);

    for (const sheet of sheets) {
      const {adopters, basicStyleElement} = constructStyleSheetRegistry.get(
        sheet,
      );

      const adoptedStyleElement = adopters.get(location);

      if (adoptedStyleElement) {
        // This operation removes the style element from the location, so we
        // need to pause watching when it happens to avoid calling
        // adoptAndRestoreStylesOnMutationCallback.
        const observer = observerRegistry.get(location);

        observer.disconnect();
        newStyles.appendChild(adoptedStyleElement);
        observer.observe();
      } else {
        const clone = basicStyleElement.cloneNode(true);
        locationRegistry.set(clone, location);
        // The index of actions array when we stopped applying actions to the
        // element (e.g., it was disconnected).
        appliedActionsCursorRegistry.set(clone, 0);
        adopters.set(location, clone);
        newStyles.appendChild(clone);
      }
    }

    // Since we already removed all elements during appending them to the
    // document fragment, we can just re-add them again.
    // we do this because IE11 doesn't support ParentNode.prepend
    if (location.firstChild) {
      location.insertBefore(newStyles, location.firstChild);
    } else {
      location.appendChild(newStyles);
    }

    // We need to apply all actions we have done with the original CSSStyleSheet
    // to each new style element and to any other element that missed last
    // applied actions (e.g., it was disconnected).
    for (const sheet of sheets) {
      const {actions, adopters} = constructStyleSheetRegistry.get(sheet);
      const adoptedStyleElement = adopters.get(location);
      const cursor = appliedActionsCursorRegistry.get(adoptedStyleElement);

      if (actions.length > 0) {
        for (let i = cursor; i < actions.length; i++) {
          const [key, args] = actions[i];
          adoptedStyleElement.sheet[key](...args);
        }

        appliedActionsCursorRegistry.set(
          adoptedStyleElement,
          actions.length - 1,
        );
      }
    }
  };

  const removeExcludedStyleSheets = (location, oldSheets) => {
    const sheets = adoptedStyleSheetsRegistry.get(location);

    for (const sheet of oldSheets) {
      if (sheets.includes(sheet)) {
        continue;
      }

      const {adopters} = constructStyleSheetRegistry.get(sheet);
      const observer = observerRegistry.get(location);
      const styleElement = adopters.get(location);

      observer.disconnect();
      styleElement.remove();
      observer.observe();
    }
  };

  const adoptAndRestoreStylesOnMutationCallback = mutations => {
    for (const {addedNodes, removedNodes} of mutations) {
      // When any style is removed, we need to re-adopt all the styles because
      // otherwise we can break the order of appended styles which will affect the
      // rules overriding.
      for (const removedNode of removedNodes) {
        const location = locationRegistry.get(removedNode);

        if (location) {
          adoptStyleSheets(location);
          break;
        }
      }

      // When the new custom element is added in the observing location, we need
      // to adopt its style sheets. However, Mutation Observer can track only
      // the top level of children while we need to catch each custom element
      // no matter how it is nested. To go through the nodes we use the
      // NodeIterator.
      for (const addedNode of addedNodes) {
        const iter = document.createNodeIterator(
          addedNode,
          NodeFilter.SHOW_ELEMENT,
          ({shadowRoot}) =>
            shadowRoot && shadowRoot.adoptedStyleSheets.length > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        );

        let node;

        while ((node = iter.nextNode())) {
          const {shadowRoot} = node;

          adoptStyleSheets(shadowRoot);
        }
      }
    }
  };

  const createObserver = location => {
    const observer = new MutationObserver(
      adoptAndRestoreStylesOnMutationCallback,
    );

    const observerTool = {
      observe: () =>
        observer.observe(location, {childList: true, subtree: true}),
      disconnect: () => observer.disconnect(),
    };

    observerRegistry.set(location, observerTool);

    observerTool.observe();
  };

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
      const locationType = location.tagName ? 'Document' : 'ShadowRoot';
      if (!Array.isArray(sheets)) {
        throw new TypeError(`Failed to set the 'adoptedStyleSheets' property on '${locationType}': Iterator getter is not callable.`);
      }

      if (!sheets.every(sheet => sheet instanceof OldCSSStyleSheet)) {
        throw new TypeError(
          `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Failed to convert value to 'CSSStyleSheet'`,
        );
      }

      const uniqueSheets = [...new Set(sheets)];

      const oldSheets = adoptedStyleSheetsRegistry.get(location) || [];
      adoptedStyleSheetsRegistry.set(location, uniqueSheets);

      // Element can adopt style sheets only when it is connected
      if (location.isConnected) {
        adoptStyleSheets(location);
        // Remove all the sheets the received array does not include.
        removeExcludedStyleSheets(location, oldSheets);
      }
    },
  };

  const oldAttachShadow = HTMLElement.prototype.attachShadow;

  
  // Double check to make sure the browser supports ShadowRoot
  if (typeof ShadowRoot !== 'undefined') {
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

  Object.defineProperty(
    Document.prototype,
    'adoptedStyleSheets',
    adoptedStyleSheetAccessors,
  );

  window.CSSStyleSheet = ConstructStyleSheet;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPolyfill);
  } else {
    initPolyfill();
  }
})(undefined);
