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

if (typeof Reflect === 'undefined') {
  window.Reflect = require('core-js-pure/es/reflect');
}

if (typeof customElements === 'undefined') {
  require('@webcomponents/webcomponentsjs');
}

if (!('assign' in Object)) {
  Object.assign = require('core-js-pure/es/object/assign');
}
