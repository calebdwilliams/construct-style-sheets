import {bootstrapper} from './shared';
import {
  clearRules,
  defineProperty,
  insertAllRules,
  rejectImports,
} from './utils';

var cssStyleSheetMethods = [
  'addImport',
  'addPageRule',
  'addRule',
  'deleteRule',
  'insertRule',
  'removeImport',
  'removeRule',
];

var NonConstructedStyleSheet = CSSStyleSheet;
var nonConstructedProto = NonConstructedStyleSheet.prototype;

nonConstructedProto.replace = function() {
  // document.styleSheets[0].replace('body {}');
  return Promise.reject(
    new DOMException("Can't call replace on non-constructed CSSStyleSheets."),
  );
};

nonConstructedProto.replaceSync = function() {
  // document.styleSheets[0].replaceSync('body {}');
  throw new DOMException(
    "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
  );
};

/**
 * @param {Object} instance
 * @returns {boolean}
 */
export function isCSSStyleSheetInstance(instance) {
  if (typeof instance !== 'object') {
    return false;
  }

  return (
    ConstructedStyleSheet.prototype.isPrototypeOf(instance) ||
    NonConstructedStyleSheet.prototype.isPrototypeOf(instance)
  );
}

export function isNonConstructedStyleSheetInstance(instance) {
  if (typeof instance !== 'object') {
    return false;
  }

  return NonConstructedStyleSheet.prototype.isPrototypeOf(instance);
}

/*
 * Private properties
 */

/**
 * Basic stylesheet is an sample stylesheet that contains all the CSS rules of
 * the current constructable stylesheet. The document or custom elements can
 * adopt constructable stylesheet; in this case, basic stylesheet's CSS rules
 * are reflected in document/custom element internal <style> elements.
 *
 * @type {WeakMap<ConstructedStyleSheet, CSSStyleSheet>}
 */
var basicStyleSheet = new WeakMap();

/**
 * Contains all locations associated with the current ConstructedStyleSheet.
 *
 * @type {WeakMap<ConstructedStyleSheet, Location[]>}
 */
var locations = new WeakMap();

/**
 * Adopter is a `<style>` element that belongs to the document or a custom
 * element and contains the content of the basic stylesheet.
 *
 * This property contains a map of `<style>` adopter associated with locations.
 *
 * @type {WeakMap<ConstructedStyleSheet, WeakMap<Location, HTMLStyleElement>>}
 */
var adoptersByLocation = new WeakMap();

/*
 * Package-level control functions
 */

/**
 * @param {ConstructedStyleSheet} sheet
 * @param {Location} location
 * @returns {HTMLStyleElement}
 */
export function addAdopterLocation(sheet, location) {
  var adopter = document.createElement('style');
  adoptersByLocation.get(sheet).set(location, adopter);
  locations.get(sheet).push(location);

  return adopter;
}

/**
 * @param {ConstructedStyleSheet} sheet
 * @param {Location} location
 * @return {HTMLStyleElement|undefined}
 */
export function getAdopterByLocation(sheet, location) {
  return adoptersByLocation.get(sheet).get(location);
}

/**
 * @param {ConstructedStyleSheet} sheet
 * @param {Location} location
 */
export function removeAdopterLocation(sheet, location) {
  adoptersByLocation.get(sheet).delete(location);
  locations.set(
    this,
    locations.get(sheet).filter(function(_location) {
      return _location !== location;
    }),
  );
}

/**
 * Re-styles a single `<style>` adopter according to the basic style sheet.
 *
 * NOTE: don't use it for disconnected adopters. It will throw an error.
 *
 * @param {ConstructedStyleSheet} sheet
 * @param {HTMLStyleElement} adopter
 */
export function restyleAdopter(sheet, adopter) {
  clearRules(adopter.sheet);
  insertAllRules(basicStyleSheet.get(sheet), adopter.sheet);
}

/*
 * Private methods
 */

/**
 * This method clears all stylesheet rules for all adopters and replaces them
 * with rules from the basic stylesheet.
 */
function restyleAdopters(sheet) {
  var basic = basicStyleSheet.get(sheet);
  var adopterRegistry = adoptersByLocation.get(sheet);
  var _locations = locations.get(sheet);

  _locations.forEach(function(location) {
    var adopter = adopterRegistry.get(location);

    if (adopter.sheet) {
      clearRules(adopter.sheet);
      insertAllRules(basic, adopter.sheet);
    }
  });
}

/**
 * This method checks if the method of the class is called correctly using the
 * CSSStyleSheet instance. It is necessary to be sure that all private
 * properties are initialized.
 */
function checkInvocationCorrectness(sheet) {
  if (!basicStyleSheet.has(sheet)) {
    throw new TypeError('Illegal invocation');
  }
}

/**
 * @constructor
 * @extends CSSStyleSheet
 */
function ConstructedStyleSheet() {
  var style = document.createElement('style');
  bootstrapper.body.appendChild(style);

  // Init private properties
  basicStyleSheet.set(this, style.sheet);
  locations.set(this, []);
  adoptersByLocation.set(this, new WeakMap());
}

var proto = ConstructedStyleSheet.prototype;

/**
 * @this {ConstructedStyleSheet}
 * @param {string} contents
 * @returns {Promise<CSSStyleSheet>}
 */
proto.replace = function replace(contents) {
  try {
    return Promise.resolve(this.replaceSync(contents));
  } catch (e) {
    return Promise.reject(e);
  }
};

/**
 *
 * @param {string} contents
 * @returns {CSSStyleSheet}
 */
proto.replaceSync = function replaceSync(contents) {
  // CSSStyleSheet.prototype.replaceSync('body {}')
  checkInvocationCorrectness(this);

  var sanitized = rejectImports(contents);
  var basic = basicStyleSheet.get(this);
  clearRules(basic);
  basic.insertRule(sanitized);

  restyleAdopters(this);

  return this;
};

defineProperty(proto, 'cssRules', {
  configurable: true,
  enumerable: true,
  get: function cssRules() {
    // CSSStyleSheet.prototype.cssRules;
    checkInvocationCorrectness(this);

    return basicStyleSheet.get(this).cssRules;
  },
});

cssStyleSheetMethods.forEach(function(method) {
  proto[method] = function() {
    checkInvocationCorrectness(this);

    var args = arguments;
    var basic = basicStyleSheet.get(this);
    var adopterRegistry = adoptersByLocation.get(this);
    var _locations = locations.get(this);

    var result = basic[method].apply(basic, args);

    _locations.forEach(function(location) {
      var adopter = adopterRegistry.get(location);
      adopter.sheet[method].apply(adopter.sheet, args);
    });

    return result;
  };
});

defineProperty(ConstructedStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: isCSSStyleSheetInstance,
});

window.CSSStyleSheet = ConstructedStyleSheet;

export default ConstructedStyleSheet;
