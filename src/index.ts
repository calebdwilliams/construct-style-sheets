import ConstructedStyleSheet from './ConstructedStyleSheet.js';
import {
  attachAdoptedStyleSheetProperty,
  getAssociatedLocation,
} from './Location.js';
import { closedShadowRootRegistry } from './shared.js';

window.CSSStyleSheet = ConstructedStyleSheet;

attachAdoptedStyleSheetProperty(Document);

if ('ShadowRoot' in window) {
  attachAdoptedStyleSheetProperty(ShadowRoot);

  const proto = Element.prototype;
  const attach = proto.attachShadow;

  proto.attachShadow = function attachShadow(init) {
    const root = attach.call(this, init);

    if (init.mode === 'closed') {
      closedShadowRootRegistry.set(this, root);
    }

    return root;
  };
}

const documentLocation = getAssociatedLocation(document);

if (documentLocation.isConnected()) {
  documentLocation.connect();
} else {
  document.addEventListener(
    'DOMContentLoaded',
    documentLocation.connect.bind(documentLocation),
  );
}
