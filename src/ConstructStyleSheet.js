import {
  OldCSSStyleSheet,
  deferredStyleSheets,
  frame,
  sheetMetadataRegistry,
  state
} from './shared';
import {rejectImports} from './utils';

const cssStyleSheetMethods = [
  'addImport',
  'addPageRule',
  'addRule',
  'deleteRule',
  'insertRule',
  'removeImport',
  'removeRule',
];

const illegalInvocation = 'Illegal invocation';

export function updatePrototype(proto) {
  proto.replace = function () {
    // document.styleSheets[0].replace('body {}');
    return Promise.reject(
      new DOMException("Can't call replace on non-constructed CSSStyleSheets.")
    );
  };

  proto.replaceSync = function () {
    // document.styleSheets[0].replaceSync('body {}');
    throw new DOMException("Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.");
  };
}

function updateAdopters(sheet) {
  const {adopters, basicStyleElement} = sheetMetadataRegistry.get(sheet);

  adopters.forEach(styleElement => {
    styleElement.innerHTML = basicStyleElement.innerHTML;
  });
}

// This class will be a substitute for the CSSStyleSheet class that
// cannot be instantiated.
class ConstructStyleSheet {
  constructor() {
    // A style element to extract the native CSSStyleSheet object.
    const basicStyleElement = document.createElement('style');

    if (state.loaded) {
      // If the polyfill is ready, use the frame.body
      frame.body.appendChild(basicStyleElement);
    } else {
      // If the polyfill is not ready, move styles to head temporarily
      document.head.appendChild(basicStyleElement);
      basicStyleElement.disabled = true;
      deferredStyleSheets.push(basicStyleElement);
    }

    // A support object to preserve all the polyfill data
    sheetMetadataRegistry.set(this, {
      adopters: new Map(),
      actions: [],
      basicStyleElement,
    });
  }

  get cssRules() {
    if (!sheetMetadataRegistry.has(this)) {
      // CSSStyleSheet.prototype.cssRules;
      throw new TypeError(illegalInvocation);
    }

    const {basicStyleElement} = sheetMetadataRegistry.get(this);
    return basicStyleElement.sheet.cssRules;
  }

  replace(contents) {
    const sanitized = rejectImports(contents);
    try {
      if (!sheetMetadataRegistry.has(this)) {
        // CSSStyleSheet.prototype.replace('body {}')
        throw new TypeError(illegalInvocation);
      }

      const {basicStyleElement} = sheetMetadataRegistry.get(this);
      basicStyleElement.innerHTML = sanitized;
      updateAdopters(this);

      return Promise.resolve(this);
    } catch(ex) {
      return Promise.reject(ex);
    }
  }

  replaceSync(contents) {
    const sanitized = rejectImports(contents);
    if (!sheetMetadataRegistry.has(this)) {
      // CSSStyleSheet.prototype.replaceSync('body {}')
      throw new TypeError(illegalInvocation)
    }

    const {basicStyleElement} = sheetMetadataRegistry.get(this);

    basicStyleElement.innerHTML = sanitized;
    updateAdopters(this);
    return this;
  }
}

// Implement all methods from the base CSSStyleSheet constructor as
// a proxy to the raw style element created during construction.
cssStyleSheetMethods.forEach(method => {
  ConstructStyleSheet.prototype[method] = function() {
    if (!sheetMetadataRegistry.has(this)) {
      throw new TypeError(illegalInvocation)
    }

    const args = arguments;
    const { adopters, actions, basicStyleElement } = sheetMetadataRegistry.get(this);
    const result = basicStyleElement.sheet[method].apply(basicStyleElement.sheet, args);

    adopters.forEach(styleElement => {
      if (styleElement.sheet) {
        styleElement.sheet[method].apply(styleElement.sheet, args);
      }
    });

    actions.push([method, args]);

    return result;
  }
});

export function instanceOfStyleSheet(instance) {
  return (
    (instance && instance.constructor === ConstructStyleSheet) ||
    instance instanceof OldCSSStyleSheet ||
    instance instanceof frame.CSSStyleSheet
  );
}

Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: instanceOfStyleSheet,
});

export default ConstructStyleSheet;
