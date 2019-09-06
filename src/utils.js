import {adoptedSheetsRegistry, frame, OldCSSStyleSheet} from './shared';

export function instanceOfStyleSheet(instance) {
  return (
    instance instanceof OldCSSStyleSheet ||
    instance instanceof frame.CSSStyleSheet
  );
}

export function checkAndPrepare(sheets, location) {
  const locationType = location.tagName ? 'Document' : 'ShadowRoot';

  if (!Array.isArray(sheets)) {
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Iterator getter is not callable.`,
    );
  }

  if (!sheets.every(instanceOfStyleSheet)) {
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Failed to convert value to 'CSSStyleSheet'`,
    );
  }

  const uniqueSheets = sheets.filter(
    (value, index) => sheets.indexOf(value) === index,
  );
  adoptedSheetsRegistry.set(location, uniqueSheets);

  return uniqueSheets;
}
