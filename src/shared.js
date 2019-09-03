// Even if the polyfill does not support ShadyCSS, it should be detected in
// order to avoid errors of parallel usage.
export const hasShadyCss =
  'ShadyCSS' in window && !window.ShadyCSS.nativeShadow;

// Style elements that will be attached to the head
// that need to be moved to the iframe
export const deferredStyleSheets = [];

// Adopted stylesheets of specific location (ShadowRoot or Document).
export const adoptedSheetsRegistry = new WeakMap();

// Metadata of specific stylesheet.
export const sheetMetadataRegistry = new WeakMap();

// Location of the specific adopter (HTMLStyleElement that stylizes this
// location).
export const locationRegistry = new WeakMap();

// MutationObserver of the specific location.
export const observerRegistry = new WeakMap();

// The cursor that points at the latest applied action (CSSStyleSheet method)
// for the specific style element.
export const appliedActionsCursorRegistry = new WeakMap();

export const state = {
  // Can we rely on document.body
  loaded: false,
};

export const frame = {
  // Polyfill-level reference to the iframe body
  body: null,

  // Reference to a iframe CSSStyleSheet class. In IE and Edge it is different
  // from the main window class.
  CSSStyleSheet: null,
};

export const OldCSSStyleSheet = CSSStyleSheet;
