(() => {
  'use strict';

  if ('adoptedStyleSheets' in document) {
    return;
  }

  let polyfillLoaded = false;
  let frameBody;
  const queue = [];

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

    polyfillLoaded = true;

    queue.forEach(({location, sheet}) => {
      // sheet = Object.assign(new CSSStyleSheet(), sheet);
      // console.log(sheet)
      sheet.prototype = CSSStyleSheet.prototype;
      const constructedStyleSheet = new CSSStyleSheet();
      console.log(constructedStyleSheet)
      for (const key in constructedStyleSheet) {
        if (!sheet[key]) {
          let prop = constructedStyleSheet[key];
          if (typeof prop === 'function') {
            prop = prop.bind(constructedStyleSheet);
          }
          sheet[key] = prop;
        }
      }
      adoptStyleSheets(location)
    });
  }

  window.addEventListener('load', initPolyfill);

  const $adoptedStyleSheets = Symbol('adoptedStyleSheets');
  const $constructStyleSheet = Symbol('constructStyleSheet');
  const $location = Symbol('location');
  const $observer = Symbol('observer');
  const $appliedActionsCursor = Symbol('methodsHistoryCursor');

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
        if ($constructStyleSheet in this) {
          for (const [, styleElement] of this[$constructStyleSheet].adopters) {
            if (styleElement.sheet) {
              styleElement.sheet[methodKey](...args);
            }
          }

          // And we also need to remember all these changes to apply them to
          // each newly adopted style element.
          this[$constructStyleSheet].actions.push([methodKey, args]);
        }

        return oldMethod.apply(this, args);
      };
    }
  };

  const updateAdopters = sheet => {
    for (const [, styleElement] of sheet[$constructStyleSheet].adopters) {
      styleElement.innerHTML =
        sheet[$constructStyleSheet].basicStyleElement.innerHTML;
    }
  };

  const importPattern = /\@import/;

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
      if (polyfillLoaded) {
        // A style element to extract the native CSSStyleSheet object.
        const basicStyleElement = document.createElement('style');
        frameBody.append(basicStyleElement);
  
        const nativeStyleSheet = basicStyleElement.sheet;
  
        // A support object to preserve all the polyfill data
        nativeStyleSheet[$constructStyleSheet] = {
          adopters: new Map(),
          actions: [],
          basicStyleElement,
        };
        
        return nativeStyleSheet;
      }
      this[$constructStyleSheet] = {
        adopters: new Map(),
        actions: [],
        basicStyleElement: document.createElement('style'),
      };
    }

    replace(contents) {
      return new Promise((resolve, reject) => {
        if (this[$constructStyleSheet]) {
          this[$constructStyleSheet].basicStyleElement.innerHTML = contents;
          resolve(this[$constructStyleSheet].basicStyleElement.sheet);
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

      if (this[$constructStyleSheet]) {
        this[$constructStyleSheet].basicStyleElement.innerHTML = contents;
        updateAdopters(this);

        return this[$constructStyleSheet].basicStyleElement.sheet;
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

    for (const sheet of location[$adoptedStyleSheets]) {
      const adoptedStyleElement = sheet[$constructStyleSheet].adopters.get(
        location,
      );

      if (!polyfillLoaded) {
        queue.push({ location, sheet });
        return;
      }

      if (adoptedStyleElement) {
        // This operation removes the style element from the location, so we
        // need to pause watching when it happens to avoid calling
        // adoptAndRestoreStylesOnMutationCallback.
        location[$observer].disconnect();
        newStyles.append(adoptedStyleElement);
        location[$observer].observe();
      } else {
        const clone = sheet[$constructStyleSheet].basicStyleElement.cloneNode(
          true,
        );
        clone[$location] = location;
        // The index of actions array when we stopped applying actions to the
        // element (e.g., it was disconnected).
        clone[$appliedActionsCursor] = 0;
        sheet[$constructStyleSheet].adopters.set(location, clone);
        newStyles.append(clone);
      }
    }

    // Since we already removed all elements during appending them to the
    // document fragment, we can just re-add them again.
    location.prepend(newStyles);

    // We need to apply all actions we have done with the original CSSStyleSheet
    // to each new style element and to any other element that missed last
    // applied actions (e.g., it was disconnected).
    for (const sheet of location[$adoptedStyleSheets]) {
      const adoptedStyleElement = sheet[$constructStyleSheet].adopters.get(
        location,
      );

      const {actions} = sheet[$constructStyleSheet];

      if (actions.length > 0) {
        for (
          let i = adoptedStyleElement[$appliedActionsCursor];
          i < actions.length;
          i++
        ) {
          const [key, args] = actions[i];
          adoptedStyleElement.sheet[key](...args);
        }

        adoptedStyleElement[$appliedActionsCursor] = actions.length - 1;
      }
    }
  };

  const removeExcludedStyleSheets = (location, oldSheets) => {
    for (const sheet of oldSheets) {
      if (location[$adoptedStyleSheets].includes(sheet)) {
        continue;
      }

      const styleElement = sheet[$constructStyleSheet].adopters.get(location);

      location[$observer].disconnect();
      styleElement.remove();
      location[$observer].observe();
    }
  };

  const adoptAndRestoreStylesOnMutationCallback = mutations => {
    for (const {addedNodes, removedNodes} of mutations) {
      // When any style is removed, we need to re-adopt all the styles because
      // otherwise we can break the order of appended styles which will affect the
      // rules overriding.
      for (const removedNode of removedNodes) {
        const location = removedNode[$location];

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

    location[$observer] = {
      observe: () =>
        observer.observe(location, {childList: true, subtree: true}),
      disconnect: () => observer.disconnect(),
    };

    location[$observer].observe();
  };

  const adoptedStyleSheetAccessors = {
    configurable: true,
    get() {
      // Technically, the real adoptedStyleSheets array is placed on the body
      // element to unify the logic with ShadowRoot. However, it is hidden under
      // the symbol, and the public interface follows the specification.
      const location = this.body ? this.body : this;

      return location[$adoptedStyleSheets] || [];
    },
    set(sheets) {
      if (!Array.isArray(sheets)) {
        throw new TypeError('Adopted style sheets must be an Array');
      }

      if (!sheets.every(sheet => sheet instanceof OldCSSStyleSheet || sheet.constructor === ConstructStyleSheet)) {
        throw new TypeError(
          'Adopted style sheets must be of type CSSStyleSheet',
        );
      }

      // If `this` is the Document, the body element should be used as a
      // location.
      const location = this.body ? this.body : this;
      const uniqueSheets = [...new Set(sheets)];

      const oldSheets = location[$adoptedStyleSheets] || [];
      location[$adoptedStyleSheets] = uniqueSheets;

      // Element can adopt style sheets only when it is connected
      if (location.isConnected) {
        adoptStyleSheets(location);
        // Remove all the sheets the received array does not include.
        removeExcludedStyleSheets(location, oldSheets);
      }
    },
  };

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
  Object.defineProperty(
    Document.prototype,
    'adoptedStyleSheets',
    adoptedStyleSheetAccessors,
  );

  window.CSSStyleSheet = ConstructStyleSheet;
})(undefined);
