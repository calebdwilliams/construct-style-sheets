import {forEach} from './shared';

export function escapeRegexString(str: string): string {
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

const safariBrokenRules = ['content'];

export function fixSafariBrokenRules(
  sheet: CSSStyleSheet,
  originalRule: string,
) {
  safariBrokenRules.forEach((ruleName) => {
    forEach.call(sheet.cssRules, (rule: CSSRule) => {
      if (!(rule instanceof CSSStyleRule) || rule.style.content === '') {
        return;
      }

      const content = rule.style.content;

      if (
        !/^["']/.test(content) &&
        new RegExp(
          ruleName + ':\\s*["\']' + escapeRegexString(content),
          'm',
        ).test(originalRule)
      ) {
        rule.style.setProperty('content', '"%%%' + content + '"');
      }
    });
  });
}

const safariBrokenRulePlaceholderPattern = /%%%/gm;

export function removeSafariPlaceholder(rule: string): string {
  return rule.replace(safariBrokenRulePlaceholderPattern, '');
}
