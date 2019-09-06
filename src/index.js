import ConstructStyleSheet, {updatePrototype} from './ConstructStyleSheet';
import {initAdoptedStyleSheets, initPolyfill} from './init';
import {OldCSSStyleSheet} from './shared';

updatePrototype(OldCSSStyleSheet.prototype);

window.CSSStyleSheet = ConstructStyleSheet;

initAdoptedStyleSheets();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPolyfill);
} else {
  initPolyfill();
}
