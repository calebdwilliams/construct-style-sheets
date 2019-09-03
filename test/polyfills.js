if (typeof Promise === 'undefined') {
  window.Promise = require('core-js-pure/es/promise');
}

if (typeof Symbol === 'undefined') {
  window.Symbol = require('core-js-pure/es/symbol');
}

if (typeof Reflect === 'undefined') {
  window.Reflect = require('core-js-pure/es/reflect');
}

if (!('assign' in Object)) {
  Object.assign = require('core-js-pure/es/object/assign');
}
