import {
  deferredStyleSheets,
  frame,
  sheetMetadataRegistry,
  state,
  OldCSSStyleSheet
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

const cssStyleSheetNewMethods = ['replace', 'replaceSync'];

export function updatePrototype(proto) {
  cssStyleSheetNewMethods.forEach(methodKey => {
    proto[methodKey] = function () {
      /* This matches Chrome's behavior. Try running this:
           var style = document.createElement('style');
           document.head.appendChild(style);
           style.sheet.replace('body { color: blue }');
      */
     return Promise.reject(
       new Error(`Failed to execute '${methodKey}' on 'CSSStyleSheet': Can't call ${methodKey} on non-constructed CSSStyleSheets.`)
     );
    }
  });
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
      throw new Error(
        "Cannot read 'cssRules' on non-constructed CSSStyleSheets.",
      )
    }

    const {basicStyleElement} = sheetMetadataRegistry.get(this);
    return basicStyleElement.sheet.cssRules;
  }

  replace(contents) {
    const sanitized = rejectImports(contents);
    return new Promise((resolve, reject) => {
      if (sheetMetadataRegistry.has(this)) {
        const {basicStyleElement} = sheetMetadataRegistry.get(this);
        
        basicStyleElement.innerHTML = sanitized;
        resolve(this);
        updateAdopters(this);
      } else {
        reject(
          new Error(
            "Can't call replace on non-constructed CSSStyleSheets.",
          ),
        );
      }
    });
  }

  replaceSync(contents) {
    const sanitized = rejectImports(contents);

    if (sheetMetadataRegistry.has(this)) {
      const {basicStyleElement} = sheetMetadataRegistry.get(this);

      basicStyleElement.innerHTML = sanitized;
      updateAdopters(this);

      return this;
    } else {
      throw new Error(
        "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
      );
    }
  }
}

// Implement all methods from the base CSSStyleSheet constructor as
// a proxy to the raw style element created during construction.
cssStyleSheetMethods.forEach(method => {
  ConstructStyleSheet.prototype[method] = function() {
    if (!sheetMetadataRegistry.has(this)) {
      throw new Error(
        `Failed to execute '${method}' on 'CSSStyleSheet': Can't call ${method} on non-constructed CSSStyleSheets.`,
      )
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
    instance.constructor === ConstructStyleSheet ||
    instance instanceof OldCSSStyleSheet ||
    (frame.CSSStyleSheet && instance instanceof frame.CSSStyleSheet)
  );
}

Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: instanceOfStyleSheet,
});

export default ConstructStyleSheet;
