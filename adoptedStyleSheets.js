(() => {
  'use strict';

  if ('adoptedStyleSheets' in document) {
    return;
  }

  const $adoptedStyleSheets = Symbol('adoptedStyleSheets');
  const $constructStyleSheet = Symbol('constructStyleSheet');
  const $location = Symbol('location');
  const $observer = Symbol('observer');

  const OldCSSStyleSheet = CSSStyleSheet;

  // Iframe is necessary because to extract the native CSSStyleSheet object
  // the style element should be connected to the DOM.
  const iframe = document.createElement('iframe');
  iframe.hidden = true;
  document.body.appendChild(iframe);

  const frameBody = iframe.contentWindow.document.body;

  const updateAdopters = sheet => {
    for (const adopter of sheet[$constructStyleSheet].adopters) {
      adopter.clone.innerHTML =
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
      // A style element to extract the native CSSStyleSheet object.
      const basicStyleElement = document.createElement('style');
      frameBody.append(basicStyleElement);

      const nativeStyleSheet = basicStyleElement.sheet;
      nativeStyleSheet.constructor.prototype.replace =
        ConstructStyleSheet.prototype.replace;
      nativeStyleSheet.constructor.prototype.replaceSync =
        ConstructStyleSheet.prototype.replaceSync;

      // A support object to preserve all the polyfill data
      nativeStyleSheet[$constructStyleSheet] = {
        adopters: new Map(),
        actions: new Map(),
        basicStyleElement,
      };

      return nativeStyleSheet;
    }

    replace(contents) {
      return new Promise((resolve, reject) => {
        if (this[$constructStyleSheet]) {
          this[$constructStyleSheet].basicStyleElement.innerHTML = contents;
          resolve(this[$constructStyleSheet].basicStyleElement.sheet);
          updateAdopters(this);
        } else {
          reject('replace can only be called on a constructed style sheet');
        }
      });
    }

    replaceSync(contents) {
      if (importPattern.test(contents)) {
        throw new Error(
          "@import is not allowed when using CSSStyleSheet's replaceSync method",
        );
      }

      if (this[$constructStyleSheet]) {
        this[$constructStyleSheet].basicStyleElement.innerHTML = contents;
        updateAdopters(this);

        return this[$constructStyleSheet].basicStyleElement.sheet;
      } else {
        throw new TypeError(
          'replaceSync can only be called on a constructed style sheet',
        );
      }
    }
  }

  OldCSSStyleSheet.prototype.replace = ConstructStyleSheet.prototype.replace;
  OldCSSStyleSheet.prototype.replaceSync =
    ConstructStyleSheet.prototype.replaceSync;

  const adoptStyleSheets = (location, sheets, observer) => {
    const newStyles = document.createDocumentFragment();
    const justCreated = new Map();

    for (const sheet of sheets) {
      const adoptedStyleElement = sheet[$constructStyleSheet].adopters.get(
        location,
      );

      if (adoptedStyleElement) {
        // This operation removes the style element from the location, so we
        // need to pause watching when it happens to avoid calling
        // restoreStylesOnMutationCallback.
        observer.disconnect();
        newStyles.append(adoptedStyleElement);
        observer.observe();
      } else {
        const clone = sheet[$constructStyleSheet].basicStyleElement.cloneNode(
          true,
        );
        clone[$location] = location;
        sheet[$constructStyleSheet].adopters.set(location, clone);
        newStyles.append(clone);
        justCreated.set(clone, sheet[$constructStyleSheet].actions);
      }
    }

    // Since we already removed all elements during appending them to the
    // document fragment, we can just re-add them again.
    location.prepend(newStyles);

    // We need to apply all changes we have done with the original
    // CSSStyleSheet to each new style element.
    for (const [createdStyleElement, actions] of justCreated) {
      for (const [key, args] of actions) {
        createdStyleElement.sheet[key](...args);
      }
    }
  };

  // When any style is removed, we need to re-adopt all the styles because
  // otherwise we can break the order of appended styles which will affect the
  // rules overriding.
  const restoreStylesOnMutationCallback = mutations => {
    for (const {removedNodes} of mutations) {
      for (const removedNode of removedNodes) {
        const location = removedNode[$location];

        if (location) {
          adoptStyleSheets(
            location,
            location.adoptedStyleSheets,
            location[$observer],
          );
          break;
        }
      }
    }
  };

  const adoptedStyleSheetAccessors = {
    configurable: true,
    get() {
      return this[$adoptedStyleSheets] || [];
    },
    set(sheets) {
      if (!Array.isArray(sheets)) {
        throw new TypeError('Adopted style sheets must be an Array');
      }

      if (!sheets.every(sheet => sheet instanceof OldCSSStyleSheet)) {
        throw new TypeError(
          'Adopted style sheets must be of type CSSStyleSheet',
        );
      }

      // If `this` is the Document, the body element should be used as a
      // location.
      const location = this.body ? this.body : this;
      const uniqueSheets = [...new Set(sheets)];

      if (!this[$adoptedStyleSheets]) {
        const observer = new MutationObserver(restoreStylesOnMutationCallback);

        this[$observer] = {
          observe: () => observer.observe(this, {childList: true}),
          disconnect: () => observer.disconnect(),
        };

        this[$observer].observe();
      } else {
        // Remove all the sheets the received array does not include.
        for (const sheet of this[$adoptedStyleSheets]) {
          if (uniqueSheets.includes(sheet)) {
            continue;
          }

          const styleElement = sheet[$constructStyleSheet].adopters.get(
            location,
          ).clone;
          this[$observer].disconnect();
          styleElement.remove();
          this[$observer].observe();
        }
      }

      this[$adoptedStyleSheets] = uniqueSheets;

      // With this style elements will be appended even before the element is
      // connected to the DOM and become unremovable due to
      // restoreStylesOnMutationCallback.
      //
      // It should not harm the developer experience, but will help to catch
      // each custom element, no matter how nested it is.
      adoptStyleSheets(location, this[$adoptedStyleSheets], this[$observer]);
    },
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

  [
    'addImport',
    'addPageRule',
    'addRule',
    'deleteRule',
    'insertRule',
    'removeImport',
    'removeRule',
  ].forEach(methodKey => {
    // Here we apply all changes we have done to the original CSSStyleSheet
    // object to all adopted style element.
    const oldMethod = OldCSSStyleSheet.prototype[methodKey];
    OldCSSStyleSheet.prototype[methodKey] = function(...args) {
      if ($constructStyleSheet in this) {
        for (const [, styleElement] of this[$constructStyleSheet].adopters) {
          styleElement.sheet[key](...args)
        }

        // And we also need to remember all these changes to apply them to
        // each newly adopted style element.
        this[$constructStyleSheet].actions.set(key, args);
      }

      return oldMethod.apply(this, args);
    };
  });

  window.CSSStyleSheet = ConstructStyleSheet;
})(undefined);
