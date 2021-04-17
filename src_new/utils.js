import {closedShadowRootRegistry} from './shared';

export var defineProperty = Object.defineProperty;

var importPattern = /@import(?:.+?);/g;

/**
 * @param {string} contents
 * @returns {string}
 */
export function rejectImports(contents = '') {
  var sheetContent = contents.replace(importPattern, '');

  if (sheetContent !== contents) {
    console.warn(
      '@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418',
    );
  }

  return sheetContent.trim();
}

/**
 * @param {CSSStyleSheet} sheet
 */
export function clearRules(sheet) {
  while (sheet.cssRules.length > 0) {
    sheet.deleteRule(0);
  }
}

/**
 * @param {CSSStyleSheet} from
 * @param {CSSStyleSheet} to
 */
export function insertAllRules({cssRules}, to) {
  for (var i = 0; i < cssRules.length; i++) {
    to.insertRule(cssRules[i].cssText);
  }
}

/**
 * Cross-platform check for the element to be connected to the DOM
 *
 * @param {Element} element
 */
export function isElementConnected(element) {
  // If the browser supports web components, it definitely supports
  // isConnected. If not, we can just check if the document contains
  // the current location.
  return 'isConnected' in element
    ? element.isConnected
    : document.contains(element);
}

/**
 * Emulates [...new Set(arr)] for older browsers.
 *
 * @template T
 * @param {ReadonlyArray<T>} arr
 * @return ReadonlyArray<T>
 */
export function unique(arr) {
  return arr.filter(function(value, index) {
    return arr.indexOf(value) === index;
  });
}

/**
 * @template T
 * @param {ReadonlyArray<T>} arr1
 * @param {ReadonlyArray<T>} arr2
 * @return {ReadonlyArray<T>}
 */
export function diff(arr1, arr2) {
  return arr1.filter(function(value) {
    return arr2.indexOf(value) === -1;
  });
}

/**
 * @param {Node} node
 */
export function removeNode(node) {
  node.parentNode.removeChild(node);
}

/**
 * @param {Element} element
 * @return {ShadowRoot|undefined}
 */
export function getShadowRoot(element) {
  return element.shadowRoot || closedShadowRootRegistry.get(element);
}
