import {closedShadowRootRegistry, safariBrokenRules} from './shared';

export const defineProperty = Object.defineProperty;
export const forEach = Array.prototype.forEach;

const importPattern = /@import.+?;?$/gm;

export function rejectImports(contents: string): string {
  const _contents = contents.replace(importPattern, '');

  if (_contents !== contents) {
    console.warn(
      '@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418',
    );
  }

  return _contents.trim();
}

export function clearRules(sheet: CSSStyleSheet): void {
  for (let i = 0; i < sheet.cssRules.length; i++) {
    sheet.deleteRule(0);
  }
}

export function insertAllRules(from: CSSStyleSheet, to: CSSStyleSheet): void {
  forEach.call(from.cssRules, (rule, i) => {
    to.insertRule(rule.cssText, i);
  });
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
  return element.shadowRoot || closedShadowRootRegistry.get(element);
}

export function escapeRegexString(str: string): string {
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

// WeakSet emulation for IE11.
const processedRulesRegistry = new WeakMap<CSSRule, boolean>();
/**
 * This function goes through all the broken Safari rules that are specified in
 * `shared.ts`. If the user had an intention to add quotes to the value of
 * broken rule, this function detects it and forcefully add quotes to the value
 * of the rule declaration.
 *
 * @param sheet The basic style sheet
 * @param originalStyle The style string user provided
 */
export function fixSafariBrokenRules(
  sheet: CSSStyleSheet,
  originalStyle: string,
) {
  safariBrokenRules.forEach((ruleName) => {
    // Detect if the user has declared a rule with the specified name, then run
    // the fixing algorithm.
    if (originalStyle.indexOf(`${ruleName}:`) > -1) {
      forEach.call(sheet.cssRules, (rule) => {
        // Skip if the rule is already fixed
        if (processedRulesRegistry.has(rule)) {
          return;
        }

        // Safari stores the value without quotes, e.g.,
        // { "content": "some string" } instead of
        // { "content": "\"some string\"" like other browsers do.
        const ruleValue = rule.style[ruleName];
        if (ruleValue !== '') {
          // Detecting if the user intended to add quotes here.
          const pattern = new RegExp(
            `${escapeRegexString(
              rule.selectorText,
            )}(?:\\s|.)*${escapeRegexString(
              ruleName,
            )}\\s*(['"]?)${escapeRegexString(ruleValue)}["']?`,
          );

          const matches = pattern.exec(originalStyle)!;

          if (matches[1] !== '') {
            rule.style[ruleName] = `${matches[1]}${ruleValue}${matches[1]}`;
          }

          processedRulesRegistry.set(rule, true);
        }
      });
    }
  });
}
