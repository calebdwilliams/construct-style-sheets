import ConstructedStyleSheet from './ConstructedStyleSheet';
import {
  attachAdoptedStyleSheetProperty,
  getAssociatedLocation,
} from './Location';
import {closedShadowRootRegistry} from './shared';

window.CSSStyleSheet = ConstructedStyleSheet;

attachAdoptedStyleSheetProperty(Document);

if ('ShadowRoot' in window) {
  attachAdoptedStyleSheetProperty(ShadowRoot);

  var proto = Element.prototype;
  var attach = proto.attachShadow;

  proto.attachShadow = function attachShadow(init) {
    var root = attach.call(this, init);

    if (init.mode === 'closed') {
      closedShadowRootRegistry.set(this, root);
    }

    return root;
  };
}

var documentLocation = getAssociatedLocation(document);

if (documentLocation.isConnected()) {
  documentLocation.connect();
} else {
  document.addEventListener(
    'DOMContentLoaded',
    documentLocation.connect.bind(documentLocation),
  );
}
