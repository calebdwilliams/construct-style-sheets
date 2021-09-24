import {bootstrapper} from './shared';

export const hasBrokenRules = (function () {
  const style = bootstrapper.createElement('style');
  style.textContent = '.test{content:"something"}';
  bootstrapper.body.appendChild(style);

  return (
    (style.sheet!.cssRules[0] as CSSStyleRule).style.content !== '"something"'
  );
})();

const brokenRulePatterns = [/content:\s*["']/gm];

/**
 * Adds a special symbol "%" to the broken rule that forces the internal Safari
 * CSS property string converter to add quotes around the value. This function
 * should be only used for the internal basic stylesheet hidden in the
 * bootstrapper because it pollutes the user content with the placeholder
 * symbols. Use the `getCssText` function to remove the placeholder from the
 * CSS string.
 *
 * @param content
 */
export function fixBrokenRules(content: string): string {
  return brokenRulePatterns.reduce(
    (acc, pattern) => acc.replace(pattern, '$&%%%'),
    content,
  );
}

const placeholderPatterns = [/(content:\s*["'])%%%/gm];

/**
 * Removes the placeholder added by `fixBrokenRules` function from the received
 * rule string.
 */
export const getCssText = hasBrokenRules
  ? (rule: CSSRule) =>
      placeholderPatterns.reduce(
        (acc, pattern) => acc.replace(pattern, '$1'),
        rule.cssText,
      )
  : (rule: CSSRule) => rule.cssText;
