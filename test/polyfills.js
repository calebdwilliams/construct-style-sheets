if (!('isConnected' in Node.prototype)) {
  require('is-connected-node/implement')
}

if (typeof WeakMap === 'undefined') {
  window.WeakMap = require('core-js-pure/es/weak-map');
}

if (typeof Map === 'undefined') {
  window.Map = require('core-js-pure/es/map');
}

if (typeof Promise === 'undefined') {
  window.Promise = require('core-js-pure/es/promise');
}

if (typeof Symbol === 'undefined') {
  window.Symbol = require('core-js-pure/es/symbol');
}

if (!('append' in Node.prototype)) {
  require('mdn-polyfills/Node.prototype.append')
}

if (!('remove' in Node.prototype)) {
  require('mdn-polyfills/Node.prototype.remove');
}

if (typeof customElements === 'undefined') {
  require('@webcomponents/webcomponentsjs');
}
