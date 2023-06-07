import { closedShadowRootRegistry } from './shared.js';

const importPattern = /@import.+?;?$/gmu;

export function rejectImports(contents: string): string {
  const _contents = contents.replace(importPattern, '');

  if (_contents !== contents) {
    console.warn(
      '@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418',
    );
  }

  return _contents.trim();
}

/**
 * Cross-platform check for the element to be connected to the DOM
 */
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
export function unique<T>(arr: readonly T[]): readonly T[] {
  return arr.filter((value, index) => arr.indexOf(value) === index);
}

export function diff<T>(arr1: readonly T[], arr2: readonly T[]): readonly T[] {
  return arr1.filter((value) => arr2.indexOf(value) === -1);
}

export function removeNode(node: Node): void {
  node.parentNode!.removeChild(node);
}

export function getShadowRoot(element: Element): ShadowRoot | undefined {
  return element.shadowRoot ?? closedShadowRootRegistry.get(element);
}
