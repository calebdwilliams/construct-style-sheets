// eslint-disable-next-line import/unambiguous
declare module 'construct-style-sheets-polyfill';

interface CSSStyleSheet {
  replace(contents: string): Promise<CSSStyleSheet>;
  replaceSync(contents: string): void;
}

interface Document {
  readonly adoptedStyleSheets: CSSStyleSheet[];
}

interface ShadowRoot {
  readonly adoptedStyleSheets: CSSStyleSheet[];
}
