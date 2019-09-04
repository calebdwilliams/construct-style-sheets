import Promise from 'core-js-pure/es/promise';
import Symbol from 'core-js-pure/es/symbol';
import Reflect from 'core-js-pure/es/reflect';
import objectAssign from 'core-js-pure/es/object/assign';

if (!('Promise' in window)) {
  window.Promise = Promise;
}

if (!('Symbol' in window)) {
  window.Symbol = Symbol;
}

if (!('Reflect' in window)) {
  window.Reflect = Reflect;
}

if (!('assign' in Object)) {
  Object.assign = objectAssign;
}
