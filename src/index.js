import ConstructStyleSheet, {updatePrototype} from './ConstructStyleSheet';
import {initAdoptedStyleSheets, initPolyfill} from './init';
import {OldCSSStyleSheet} from './shared';
import {isDocumentLoading} from './utils';

updatePrototype(OldCSSStyleSheet.prototype);

window.CSSStyleSheet = ConstructStyleSheet;

initAdoptedStyleSheets();

if (isDocumentLoading()) {
  document.addEventListener('DOMContentLoaded', initPolyfill);
} else {
  initPolyfill();
}
