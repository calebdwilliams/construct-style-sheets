/**
 * Even if the polyfill does not support ShadyCSS, it should be detected in
 * order to avoid errors of parallel usage.
 * @type {boolean}
 */
export var hasShadyCss = 'ShadyCSS' in window && !window.ShadyCSS.nativeShadow;

/**
 * The in-memory HTMLDocument that is necessary to get the internal
 * CSSStyleSheet of a basic `<style>` element.
 * @type {Document}
 */
export var bootstrapper = document.implementation.createHTMLDocument('boot');

/**
 * Since ShadowRoots with the closed mode are not available via
 * element.shadowRoot, we need to preserve their roots in the registry to get
 * an ability to support their constructed style sheets as well.
 *
 * @type {WeakMap<Element, ShadowRoot>}
 */
export var closedShadowRootRegistry = new WeakMap();
