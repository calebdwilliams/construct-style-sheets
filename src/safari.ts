import {bootstrapper} from './shared';

export const hasBrokenRules = (function () {
  const style = bootstrapper.createElement('style');
  style.textContent = '.test{content:"something"}';
  bootstrapper.body.appendChild(style);

  return (
    (style.sheet!.cssRules[0] as CSSStyleRule).style.content !== '"something"'
  );
})();

const brokenRules = ['content'];

export function fixBrokenRules(content: string): string {
  return brokenRules.reduce(
    (acc, ruleName) =>
      acc.replace(new RegExp(`${ruleName}:\\s*["']`, 'gm'), '$0%_FIX_%'),
    content,
  );
}

const fixTokenPattern = /%_FIX_%/gm;

export const getCssText = hasBrokenRules
  ? function (rule: CSSRule) {
      return rule.cssText.replace(fixTokenPattern, '');
    }
  : function (rule: CSSRule) {
      return rule.cssText;
    };
