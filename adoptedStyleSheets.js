(function() {
  'use strict';

  if ('adoptedStyleSheets' in document) {
    return;
  }

  // Support for NodeList and other collections that do not have the built-in
  // forEach method.
  var forEach = Array.prototype.forEach;

  // Can we rely on document.body
  var polyfillLoaded = false;

  // Polyfill-level reference to the iframe body
  var frameBody, frameCSSStyleSheet;

  // Style elements that will be attached to the head
  // that need to be moved to the iframe
  var deferredStyleSheets = [];

  // Initialize the polyfill — Will be called on the window's load event
  function initPolyfill() {
    // Iframe is necessary because to extract the native CSSStyleSheet object
    // the style element should be connected to the DOM.
    var iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.appendChild(iframe);

    frameBody = iframe.contentWindow.document.body;
    frameCSSStyleSheet = iframe.contentWindow.CSSStyleSheet;

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
    deferredStyleSheets.forEach(function(sheet) {
      frameBody.appendChild(sheet);
      sheet.disabled = false;
    });

    // Clear out the deferredStyleSheets array
    deferredStyleSheets.length = 0;
  }

  var adoptedStyleSheetsRegistry = new WeakMap();
  var constructStyleSheetRegistry = new WeakMap();
  var locationRegistry = new WeakMap();
  var observerRegistry = new WeakMap();
  var appliedActionsCursorRegistry = new WeakMap();

  var OldCSSStyleSheet = CSSStyleSheet;

  function instanceOfStyleSheet(instance) {
    return (
      instance instanceof OldCSSStyleSheet ||
      instance instanceof frameCSSStyleSheet
    );
  }

  var cssStyleSheetMethods = [
    'addImport',
    'addPageRule',
    'addRule',
    'deleteRule',
    'insertRule',
    'removeImport',
    'removeRule'
  ];

  var cssStyleSheetNewMethods = ['replace', 'replaceSync'];

  function updatePrototype(proto) {
    cssStyleSheetNewMethods.forEach(function(methodKey) {
      proto[methodKey] = ConstructStyleSheet.prototype[methodKey];
    });

    cssStyleSheetMethods.forEach(function(methodKey) {
      // Here we apply all changes we have done to the original CSSStyleSheet
      // object to all adopted style element.
      var oldMethod = proto[methodKey];
      proto[methodKey] = function() {
        var args = arguments;

        if (constructStyleSheetRegistry.has(this)) {
          var constructStyleSheet = constructStyleSheetRegistry.get(this);

          constructStyleSheet.adopters.forEach(function(styleElement) {
            if (styleElement.sheet) {
              styleElement.sheet[methodKey].apply(styleElement.sheet, args);
            }
          });

          // And we also need to remember all these changes to apply them to
          // each newly adopted style element.
          constructStyleSheet.actions.push([methodKey, args]);
        }

        return oldMethod.apply(this, args);
      };
    });
  }

  function updateAdopters(sheet) {
    var constructStyleSheet = constructStyleSheetRegistry.get(sheet);

    constructStyleSheet.adopters.forEach(function(styleElement) {
      styleElement.innerHTML = constructStyleSheet.basicStyleElement.innerHTML;
    });
  }

  var importPattern = /@import/;

  // This class will be a substitute for the CSSStyleSheet class that
  // cannot be instantiated. The `new` operation will return the native
  // CSSStyleSheet object extracted from a style element appended to the
  // iframe.
  function ConstructStyleSheet() {
    // A style element to extract the native CSSStyleSheet object.
    var basicStyleElement = document.createElement('style');

    if (polyfillLoaded) {
      // If the polyfill is ready, use the framebody
      frameBody.appendChild(basicStyleElement);
    } else {
      // If the polyfill is not ready, move styles to head temporarily
      document.head.appendChild(basicStyleElement);
      basicStyleElement.disabled = true;
      deferredStyleSheets.push(basicStyleElement);
    }

    var nativeStyleSheet = basicStyleElement.sheet;

    // A support object to preserve all the polyfill data
    constructStyleSheetRegistry.set(nativeStyleSheet, {
      adopters: new Map(),
      actions: [],
      basicStyleElement: basicStyleElement
    });

    return nativeStyleSheet;
  }

  // Allows instanceof checks with the window.CSSStyleSheet.
  Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
    configurable: true,
    value: instanceOfStyleSheet
  });

  ConstructStyleSheet.prototype.replace = function replace(contents) {
    var self = this;

    return new Promise(function(resolve, reject) {
      if (constructStyleSheetRegistry.has(self)) {
        var basicStyleElement = constructStyleSheetRegistry.get(self)
          .basicStyleElement;

        basicStyleElement.innerHTML = contents;
        resolve(basicStyleElement.sheet);
        updateAdopters(self);
      } else {
        reject(
          new Error(
            "Failed to execute 'replace' on 'CSSStyleSheet': Can't call replace on non-constructed CSSStyleSheets."
          )
        );
      }
    });
  };

  ConstructStyleSheet.prototype.replaceSync = function replaceSync(contents) {
    if (importPattern.test(contents)) {
      throw new Error(
        '@import rules are not allowed when creating stylesheet synchronously'
      );
    }

    if (constructStyleSheetRegistry.has(this)) {
      var basicStyleElement = constructStyleSheetRegistry.get(this)
        .basicStyleElement;

      basicStyleElement.innerHTML = contents;
      updateAdopters(this);

      return basicStyleElement.sheet;
    } else {
      throw new Error(
        "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets."
      );
    }
  };

  updatePrototype(OldCSSStyleSheet.prototype);

  function adoptStyleSheets(location) {
    var newStyles = document.createDocumentFragment();
    var sheets = adoptedStyleSheetsRegistry.get(location);

    sheets.forEach(function(sheet) {
      var constructStyleSheet = constructStyleSheetRegistry.get(sheet);

      var adoptedStyleElement = constructStyleSheet.adopters.get(location);

      if (adoptedStyleElement) {
        // This operation removes the style element from the location, so we
        // need to pause watching when it happens to avoid calling
        // adoptAndRestoreStylesOnMutationCallback.
        var observer = observerRegistry.get(location);

        observer.disconnect();
        newStyles.appendChild(adoptedStyleElement);
        observer.observe();
      } else {
        var clone = constructStyleSheet.basicStyleElement.cloneNode(true);
        locationRegistry.set(clone, location);
        // The index of actions array when we stopped applying actions to the
        // element (e.g., it was disconnected).
        appliedActionsCursorRegistry.set(clone, 0);
        constructStyleSheet.adopters.set(location, clone);
        newStyles.appendChild(clone);
      }
    });

    // Since we already removed all elements during appending them to the
    // document fragment, we can just re-add them again.
    if (location.firstChild) {
      location.insertBefore(newStyles, location.firstChild);
    } else {
      location.appendChild(newStyles);
    }

    // We need to apply all actions we have done with the original CSSStyleSheet
    // to each new style element and to any other element that missed last
    // applied actions (e.g., it was disconnected).
    sheets.forEach(function(sheet) {
      var constructStyleSheet = constructStyleSheetRegistry.get(sheet);
      var adoptedStyleElement = constructStyleSheet.adopters.get(location);
      var cursor = appliedActionsCursorRegistry.get(adoptedStyleElement);

      if (constructStyleSheet.actions.length > 0) {
        for (var i = cursor; i < constructStyleSheet.actions.length; i++) {
          var key = constructStyleSheet.actions[i][0],
            args = constructStyleSheet.actions[i][1];

          adoptedStyleElement.sheet[key].apply(adoptedStyleElement.sheet, args);
        }

        appliedActionsCursorRegistry.set(
          adoptedStyleElement,
          constructStyleSheet.actions.length - 1
        );
      }
    });
  }

  function removeExcludedStyleSheets(location, oldSheets) {
    var sheets = adoptedStyleSheetsRegistry.get(location);

    oldSheets.forEach(function(sheet) {
      if (sheets.indexOf(sheet) > -1) {
        return;
      }

      var adopters = constructStyleSheetRegistry.get(sheet).adopters;
      var observer = observerRegistry.get(location);
      var styleElement = adopters.get(location);

      observer.disconnect();
      styleElement.parentNode.removeChild(styleElement);
      observer.observe();
    });
  }

  function adoptAndRestoreStylesOnMutationCallback(mutations) {
    mutations.forEach(function(mutation) {
      // When any style is removed, we need to re-adopt all the styles because
      // otherwise we can break the order of appended styles which will affect the
      // rules overriding.
      forEach.call(mutation.removedNodes, function(removedNode) {
        var location = locationRegistry.get(removedNode);

        if (location) {
          adoptStyleSheets(location);
        }
      });

      // When the new custom element is added in the observing location, we need
      // to adopt its style sheets. However, Mutation Observer can track only
      // the top level of children while we need to catch each custom element
      // no matter how it is nested. To go through the nodes we use the
      // NodeIterator.
      forEach.call(mutation.addedNodes, function(addedNode) {
        var iter = document.createNodeIterator(
          addedNode,
          NodeFilter.SHOW_ELEMENT,
          function(node) {
            return node.shadowRoot &&
              node.shadowRoot.adoptedStyleSheets.length > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          },
          // IE createNodeIterator method accepts 5 args
          null,
          false
        );

        var node;

        while ((node = iter.nextNode())) {
          adoptStyleSheets(node.shadowRoot);
        }
      });
    });
  }

  function createObserver(location) {
    var observer = new MutationObserver(
      adoptAndRestoreStylesOnMutationCallback
    );

    var observerTool = {
      observe: function() {
        observer.observe(location, {childList: true, subtree: true});
      },
      disconnect: function() {
        observer.disconnect();
      }
    };

    observerRegistry.set(location, observerTool);

    observerTool.observe();
  }

  function checkAndPrepare(sheets, location) {
    var locationType = location.tagName ? 'Document' : 'ShadowRoot';

    if (!Array.isArray(sheets)) {
      throw new TypeError(
        "Failed to set the 'adoptedStyleSheets' property on " +
          locationType +
          ': Iterator getter is not callable.'
      );
    }

    if (!sheets.every(instanceOfStyleSheet)) {
      throw new TypeError(
        "Failed to set the 'adoptedStyleSheets' property on " +
          locationType +
          ": Failed to convert value to 'CSSStyleSheet'"
      );
    }

    return sheets.filter(function(value, index) {
      return sheets.indexOf(value) === index;
    });
  }

  var adoptedStyleSheetAccessors = {
    configurable: true,
    get: function() {
      // Technically, the real adoptedStyleSheets array is placed on the body
      // element to unify the logic with ShadowRoot. However, it is hidden
      // in the WeakMap, and the public interface follows the specification.
      return adoptedStyleSheetsRegistry.get(this.body ? this.body : this) || [];
    },
    set: function(sheets) {
      // If `this` is the Document, the body element should be used as a
      // location.
      var location = this.body ? this.body : this;

      var uniqueSheets = checkAndPrepare(sheets, location);

      var oldSheets = adoptedStyleSheetsRegistry.get(location) || [];
      adoptedStyleSheetsRegistry.set(location, uniqueSheets);

      // If the browser supports web components, it definitely supports
      // isConnected. If not, we can just check if the document contains
      // the current location.
      var isConnected =
        'isConnected' in location
          ? location.isConnected
          : document.contains(location);

      // Element can adopt style sheets only when it is connected
      if (isConnected) {
        adoptStyleSheets(location);
        // Remove all the sheets the received array does not include.
        removeExcludedStyleSheets(location, oldSheets);
      }
    }
  };

  // If the ShadyDOM is defined, the polyfill is loaded. Then, let's rely on
  // it; otherwise, we check the existence of the ShadowRoot.
  if ('ShadyCSS' in window && !window.ShadyCSS.nativeShadow) {
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      get: function() {
        return adoptedStyleSheetsRegistry.get(this) || [];
      },
      set: function(sheets) {
        var uniqueSheets = checkAndPrepare(sheets, location);

        var cssToAdopt = uniqueSheets.map(function(sheet) {
          return constructStyleSheetRegistry.get(
            sheet
          ).basicStyleElement.innerHTML;
        });

        ShadyCSS.ScopingShim.prepareAdoptedCssText(
          cssToAdopt,
          this.host.localName
        );
      }
    });
  } else if (typeof ShadowRoot !== 'undefined') {
    var oldAttachShadow = HTMLElement.prototype.attachShadow;

    // Shadow root of each element should be observed to add styles to all
    // elements added to this root.
    HTMLElement.prototype.attachShadow = function() {
      var location = oldAttachShadow.apply(this, arguments);
      createObserver(location);

      return location;
    };

    Object.defineProperty(
      ShadowRoot.prototype,
      'adoptedStyleSheets',
      adoptedStyleSheetAccessors
    );
  }

  Object.defineProperty(
    Document.prototype,
    'adoptedStyleSheets',
    adoptedStyleSheetAccessors
  );

  window.CSSStyleSheet = ConstructStyleSheet;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPolyfill);
  } else {
    initPolyfill();
  }
})(undefined);
