(() => {
  'use strict';

  if ('adoptedStyleSheets' in document) {
    return;
  }

  const $adoptedStyleSheets = Symbol('adoptedStyleSheets');
  const $constructStyleSheet = Symbol('constructStyleSheet');
  const $location = Symbol('location');
  const $obsolete = Symbol('obsolete');
  const $ignoreOnce = Symbol('ignoreOnce');

  const OldCSSStyleSheet = CSSStyleSheet;

  // Iframe is necessary because to extract the native CSSStyleSheet object
  // the style element should be connected to the DOM.
  const iframe = document.createElement('iframe');
  iframe.hidden = true;
  document.body.appendChild(iframe);

  const frameBody = iframe.contentWindow.document.body;

  const updateAdopters = sheet => {
    sheet[$constructStyleSheet].adopters.forEach(adopter => {
      adopter.clone.innerHTML =
        sheet[$constructStyleSheet].basicStyleElement.innerHTML;
    });
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
      frameBody.appendChild(basicStyleElement);

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

  const insertStyleSheets = (location, sheets) => {
    const newStyles = document.createDocumentFragment();
    const justCreated = new Map();

    sheets.forEach(sheet => {
      const adoptedStyleElement = sheet[$constructStyleSheet].adopters.get(
        location,
      );

      if (adoptedStyleElement) {
        // This operation removes the style element from the location, so we
        // need to ignore it once in the supportStyleOnMutationCallback.
        adoptedStyleElement[$ignoreOnce] = true;
        newStyles.append(adoptedStyleElement);
      } else {
        const clone = sheet[$constructStyleSheet].basicStyleElement.cloneNode(
          true,
        );
        clone[$location] = location;
        sheet[$constructStyleSheet].adopters.set(location, clone);
        newStyles.append(clone);
        justCreated.set(clone, sheet[$constructStyleSheet].actions);
      }
    });

    // Since we already removed all elements during appending them to the
    // document fragment, we can just re-add them again.
    location.prepend(newStyles);

    // We need to apply all changes we have done with the original
    // CSSStyleSheet to each new style element.
    justCreated.forEach((actions, createdStyleElement) =>
      actions.forEach((args, key) => {
        createdStyleElement.sheet[key](...args);
      }),
    );
  };

  const supportStyleOnMutationCallback = mutations =>
    mutations.forEach(({addedNodes, removedNodes}) => {
      removedNodes.forEach(removedNode => {
        if (
          removedNode[$location] &&
          !removedNode[$obsolete] &&
          !removedNode[$ignoreOnce]
        ) {
          Promise.resolve().then(() => {
            removedNode[$location].prepend(removedNode);
          });
        }

        if (removedNode[$ignoreOnce]) {
          removedNode[$ignoreOnce] = false;
        }
      });

      addedNodes.forEach(addedNode => {
        // Only the root nodes are added to the `addedNodes` collection,
        // but custom elements can add deeply nested collections. To support
        // this case, we need to go through all nodes and find all custom
        // elements however nested they are.
        const iter = document.createNodeIterator(
          addedNode,
          NodeFilter.SHOW_ELEMENT,
          ({shadowRoot}) =>
            shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
        );

        let currentNode;

        while ((currentNode = iter.nextNode())) {
          insertStyleSheets(
            currentNode.shadowRoot,
            currentNode.shadowRoot.adoptedStyleSheets,
          );
        }
      });
    });

  const supportStyleOnMutationOptions = {
    childList: true,
    subtree: true,
  };

  const documentObserver = new MutationObserver(supportStyleOnMutationCallback);
  documentObserver.observe(document.body, supportStyleOnMutationOptions);

  const adoptedStyleSheetAccessors = {
    configurable: true,
    get() {
      return this[$adoptedStyleSheets] || [];
    },
    set(sheets) {
      if (!Array.isArray(sheets)) {
        throw new TypeError('Adopted style sheets must be an Array');
      }

      sheets.forEach(sheet => {
        if (!sheet instanceof OldCSSStyleSheet) {
          throw new TypeError(
            'Adopted style sheets must be of type CSSStyleSheet',
          );
        }
      });

      // If `this` is the Document, the body element should be used as a
      // location.
      const location = this.body ? this.body : this;
      const uniqueSheets = [...new Set(sheets)];

      if (!this[$adoptedStyleSheets]) {
        const observer = new MutationObserver(supportStyleOnMutationCallback);
        observer.observe(this, supportStyleOnMutationOptions);
      } else {
        // Remove all the sheets the received array does not include.
        for (const sheet of this[$adoptedStyleSheets]) {
          if (uniqueSheets.includes(sheet)) {
            continue;
          }

          const styleElement = sheet[$constructStyleSheet].adopters.get(
            location,
          ).clone;
          // To make sure it won't be restored by a supportStyleOnMutationCallback.
          styleElement[$obsolete] = true;
          styleElement.remove();
        }
      }

      this[$adoptedStyleSheets] = uniqueSheets;

      if (this.isConnected) {
        insertStyleSheets(location, this[$adoptedStyleSheets]);
      }
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
        this[$constructStyleSheet].adopters.forEach(styleElement =>
          styleElement.sheet[key](...args),
        );

        // And we also need to remember all these changes to apply them to
        // each newly adopted style element.
        this[$constructStyleSheet].actions.set(key, args);
      }

      return oldMethod.apply(this, args);
    };
  });

  window.CSSStyleSheet = ConstructStyleSheet;
})(undefined);
