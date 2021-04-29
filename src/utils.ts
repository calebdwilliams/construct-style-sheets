import {closedShadowRootRegistry} from './shared';

export var defineProperty = Object.defineProperty;
export var forEach = Array.prototype.forEach;

var importPattern = /@import.+?;?$/gm;

export function rejectImports(contents: string): string {
  var _contents = contents.replace(importPattern, '');

  if (_contents !== contents) {
    console.warn(
      '@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418',
    );
  }

  return _contents.trim();
}

/*#__PURE__*/
export function clearRules(sheet: CSSStyleSheet): void {
  while (sheet.cssRules.length > 0) {
    sheet.deleteRule(0);
  }
}

/*#__PURE__*/
export function insertAllRules(from: CSSStyleSheet, to: CSSStyleSheet): void {
  forEach.call(from.cssRules, function (rule, i) {
    to.insertRule(rule.cssText, i);
  });
}

/**
 * Cross-platform check for the element to be connected to the DOM
 */
/*#__PURE__*/
export function isElementConnected(element: Element): boolean {
  // If the browser supports web components, it definitely supports
  // isConnected. If not, we can just check if the document contains
  // the current location.
  return 'isConnected' in element
    ? element.isConnected
    : document.contains(element);
}

/**
 * Emulates [...new Set(arr)] for older browsers.
 */
/*#__PURE__*/
export function unique<T>(arr: readonly T[]): readonly T[] {
  return arr.filter(function (value, index) {
    return arr.indexOf(value) === index;
  });
}

/*#__PURE__*/
export function diff<T>(arr1: readonly T[], arr2: readonly T[]): readonly T[] {
  return arr1.filter(function (value) {
    return arr2.indexOf(value) === -1;
  });
}

/*#__PURE__*/
export function removeNode(node: Node): void {
  node.parentNode!.removeChild(node);
}

/*#__PURE__*/
export function getShadowRoot(element: Element): ShadowRoot | undefined {
  return element.shadowRoot || closedShadowRootRegistry.get(element);
}
