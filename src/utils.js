import {adoptedSheetsRegistry} from './shared';
import {instanceOfStyleSheet} from './ConstructStyleSheet';

const importPattern = /@import\surl(.*?);/gi;

export function checkAndPrepare(sheets, container) {
  const locationType = container === document ? 'Document' : 'ShadowRoot';

  if (!Array.isArray(sheets)) {
    // document.adoptedStyleSheets = new CSSStyleSheet();
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Iterator getter is not callable.`,
    );
  }

  if (!sheets.every(instanceOfStyleSheet)) {
    // document.adoptedStyleSheets = [document.styleSheets[0]];
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Failed to convert value to 'CSSStyleSheet'`,
    );
  }

  const uniqueSheets = sheets.filter(
    (value, index) => sheets.indexOf(value) === index,
  );
  adoptedSheetsRegistry.set(container, uniqueSheets);

  return uniqueSheets;
}

export function isDocumentLoading() {
  return document.readyState === 'loading';
}

export function getAdoptedStyleSheet(location) {
  return adoptedSheetsRegistry.get(
    location.parentNode === document.documentElement
      ? document
      : location,
  );
}

export function rejectImports(contents) {
  const imports = contents.match(importPattern, '') || [];
  let sheetContent = contents;
  if (imports.length) {
    console.warn(
      '@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418'
    );
    imports.forEach(_import => {
      sheetContent = sheetContent.replace(_import, '');
    });
  }
  return sheetContent;
}
