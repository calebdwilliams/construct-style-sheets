/**
 * Even if the polyfill does not support ShadyCSS, it should be detected in
 * order to avoid errors of parallel usage.
 */
// @ts-expect-error: ShadyCSS is not a standard Window property.
export const hasShadyCss = 'ShadyCSS' in window && !ShadyCSS.nativeShadow;

/**
 * The in-memory HTMLDocument that is necessary to get the internal
 * CSSStyleSheet of a basic `<style>` element.
 */
export const bootstrapper = document.implementation.createHTMLDocument('boot');

/**
 * Since ShadowRoots with the closed mode are not available via
 * element.shadowRoot, we need to preserve their roots in the registry to get
 * an ability to support their constructed style sheets as well.
 */
export const closedShadowRootRegistry = new WeakMap<Element, ShadowRoot>();

// Workaround for IE that does not support the DOMException constructor
export const _DOMException =
  typeof DOMException === 'object' ? Error : DOMException;

export const defineProperty = Object.defineProperty;
export const forEach = Array.prototype.forEach;
