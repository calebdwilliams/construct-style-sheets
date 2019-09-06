import {
  deferredStyleSheets,
  frame,
  sheetMetadataRegistry,
  state,
} from './shared';
import {instanceOfStyleSheet} from './utils';

const importPattern = /@import/;

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
  for (let i = 0, len = cssStyleSheetNewMethods.length; i < len; i++) {
    proto[cssStyleSheetNewMethods[i]] = ConstructStyleSheet.prototype[cssStyleSheetNewMethods[i]];
  }

  // ForEach it because we need to preserve "methodKey" in the created function
  cssStyleSheetMethods.forEach(methodKey => {
    // Here we apply all changes we have done to the original CSSStyleSheet
    // object to all adopted style element.
    const oldMethod = proto[methodKey];

    proto[methodKey] = function() {
      const args = arguments;
      const result = oldMethod.apply(this, args);

      if (sheetMetadataRegistry.has(this)) {
        const {adopters, actions} = sheetMetadataRegistry.get(this);

        adopters.forEach(styleElement => {
          if (styleElement.sheet) {
            styleElement.sheet[methodKey].apply(styleElement.sheet, args);
          }
        });

        // And we also need to remember all these changes to apply them to
        // each newly adopted style element.
        actions.push([methodKey, args]);
      }

      return result;
    };
  });
}

function updateAdopters(sheet) {
  const {adopters, basicStyleElement} = sheetMetadataRegistry.get(sheet);

  adopters.forEach(styleElement => {
    styleElement.innerHTML = basicStyleElement.innerHTML;
  });
}

// This class will be a substitute for the CSSStyleSheet class that
// cannot be instantiated. The `new` operation will return the native
// CSSStyleSheet object extracted from a style element appended to the
// iframe.
export default class ConstructStyleSheet {
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

    const nativeStyleSheet = basicStyleElement.sheet;

    // A support object to preserve all the polyfill data
    sheetMetadataRegistry.set(nativeStyleSheet, {
      adopters: new Map(),
      actions: [],
      basicStyleElement,
    });

    return nativeStyleSheet;
  }

  replace(contents) {
    return new Promise((resolve, reject) => {
      if (sheetMetadataRegistry.has(this)) {
        const {basicStyleElement} = sheetMetadataRegistry.get(this);

        basicStyleElement.innerHTML = contents;
        resolve(basicStyleElement.sheet);
        updateAdopters(this);
      } else {
        reject(
          new Error(
            "Failed to execute 'replace' on 'CSSStyleSheet': Can't call replace on non-constructed CSSStyleSheets.",
          ),
        );
      }
    });
  }

  replaceSync(contents) {
    if (importPattern.test(contents)) {
      throw new Error(
        '@import rules are not allowed when creating stylesheet synchronously',
      );
    }

    if (sheetMetadataRegistry.has(this)) {
      const {basicStyleElement} = sheetMetadataRegistry.get(this);

      basicStyleElement.innerHTML = contents;
      updateAdopters(this);

      return basicStyleElement.sheet;
    } else {
      throw new Error(
        "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
      );
    }
  }
}

Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: instanceOfStyleSheet,
});
