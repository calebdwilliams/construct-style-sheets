declare module 'construct-style-sheets-polyfill';

interface CSSStyleSheet {
  replace(text: string): Promise<CSSStyleSheet>;
  replaceSync(text: string): CSSStyleSheet;
}

interface Document {
  adoptedStyleSheets: readonly CSSStyleSheet[];
}

interface ShadowRoot {
  adoptedStyleSheets: readonly CSSStyleSheet[];
}
