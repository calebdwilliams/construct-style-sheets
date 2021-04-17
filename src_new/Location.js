import {
  addAdopterLocation,
  getAdopterByLocation,
  isCSSStyleSheetInstance,
  isNonConstructedStyleSheetInstance,
  removeAdopterLocation,
  restyleAdopter,
} from './ConstructedStyleSheet';
import {hasShadyCss} from './shared';
import {
  defineProperty,
  diff,
  getShadowRoot,
  isElementConnected,
  removeNode,
  unique,
} from './utils';

/**
 * @type {MutationObserverInit}
 */
var defaultObserverOptions = {childList: true, subtree: true};

/**
 * @type {WeakMap<ShadowRoot|Document, Location>}
 */
var locations = new WeakMap();

/**
 * Searches for the location associated with the element. If no location found,
 * creates a new one and adds it to the registry.
 *
 * @param {ShadowRoot|Document} element
 */
export function getAssociatedLocation(element) {
  var location = locations.get(element);

  if (!location) {
    location = new Location(element);
    locations.set(element, location);
  }

  return location;
}

/**
 * @param {Node} node
 * @return {NodeIterator}
 */
function createWebComponentIterator(node) {
  return document.createNodeIterator(
    node,
    NodeFilter.SHOW_ELEMENT,
    function(foundNode) {
      var root = getShadowRoot(foundNode);

      return root && root.adoptedStyleSheets.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
    // IE createNodeIterator method accepts 5 args
    null,
    false,
  );
}

/**
 *
 * @param {typeof Document|typeof ShadowRoot} constructor
 * @return {ReadonlyArray<ConstructedStyleSheet>}
 */
export function attachAdoptedStyleSheetProperty(constructor) {
  defineProperty(constructor.prototype, 'adoptedStyleSheets', {
    configurable: true,
    enumerable: true,
    get() {
      return getAssociatedLocation(this).sheets;
    },
    /**
     * @param {ReadonlyArray<ConstructedStyleSheet>} sheets
     */
    set(sheets) {
      var location = getAssociatedLocation(this);
      location.update(sheets);
    },
  });
}

/**
 * @constructor
 * @param {ShadowRoot|Document} element
 * @private
 */
function Location(element) {
  var _this = this;

  /**
   * A root element (either ShadowRoot or Document) that has the
   * `adoptedStyleSheets` property set.
   *
   * @type {ShadowRoot|Document}
   * @private
   */
  _this._element = element;

  /**
   * A list of constructable style sheets added to the current location via
   * `adoptedStyleSheets` property.
   *
   * @type {ReadonlyArray<ConstructedStyleSheet>}
   */
  _this.sheets = [];

  /**
   * A result of [...new Set(...this.sheets)] operation.
   *
   * @type {ReadonlyArray<ConstructedStyleSheet>}
   * @private
   */
  _this._uniqueSheets = [];

  /**
   * An observer that adds and restores `<style>` adopters to the location
   * element. It also runs a `connect` for a location associated with the added
   * element, and a `disconnect` function for a location of removed element.
   *
   * @type {MutationObserver}
   * @private
   */
  _this._observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (!hasShadyCss) {
        // When the new custom element is added to the observing location, we
        // need to adopt its style sheets. However, since any added node may
        // contain deeply nested custom elements we need to explore the whole
        // tree.
        mutation.addedNodes.forEach(function(node) {
          var iter = createWebComponentIterator(node);

          for (var next; (next = iter.nextNode()); ) {
            getAssociatedLocation(next).connect();
          }
        });
      }

      // When any `<style>` adopter is removed, we need to re-adopt all the
      // styles because otherwise we can break the order of appended styles
      // which affects the rules overriding.
      mutation.removedNodes.forEach(function(node) {
        if (_this._isExistingAdopter(node)) {
          _this._adopt();
        }

        // We have to stop observers for disconnected nodes.
        if (!hasShadyCss) {
          var iter = createWebComponentIterator(node);

          for (var next; (next = iter.nextNode()); ) {
            getAssociatedLocation(next).disconnect();
          }
        }
      });
    });
  });
}

var proto = Location.prototype;

/**
 * Checks if the current location is connected to the DOM.
 *
 * @returns {boolean}
 */
proto.isConnected = function isConnected() {
  return this._element instanceof Document
    ? this._element.readyState !== 'loading'
    : isElementConnected(this._element.activeElement);
};

/**
 * The `connectedCallback` method for a location. Runs when the location is
 * connected to the DOM.
 */
proto.connect = function connect() {
  this._adopt();
};

/**
 * The `disconnectedCallback` method for a location. Runs when the location is
 * disconnected from the DOM.
 */
proto.disconnect = function disconnect() {
  this._observer.disconnect();
};

/**
 * Called when the new set of constructed style sheets is set to the
 * `adoptedStyleSheets` property of Document or ShadowRoot.
 *
 * @param {ReadonlyArray<ConstructedStyleSheet>} sheets
 */
proto.update = function update(sheets) {
  var _this = this;
  var locationType = _this._element === document ? 'Document' : 'ShadowRoot';

  if (!Array.isArray(sheets)) {
    // document.adoptedStyleSheets = new CSSStyleSheet();
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Iterator getter is not callable.`,
    );
  }

  if (!sheets.every(isCSSStyleSheetInstance)) {
    // document.adoptedStyleSheets = ['non-CSSStyleSheet value'];
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Failed to convert value to 'CSSStyleSheet'`,
    );
  }

  if (sheets.some(isNonConstructedStyleSheetInstance)) {
    // document.adoptedStyleSheets = [document.styleSheets[0]];
    throw new TypeError(
      `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Can't adopt non-constructed stylesheets`,
    );
  }

  var oldUniqueSheets = _this._uniqueSheets;
  var uniqueSheets = unique(sheets);

  // Style sheets that existed in the old sheet list but was excluded in the
  // new one.
  var removedSheets = diff(oldUniqueSheets, uniqueSheets);

  removedSheets.forEach(function(sheet) {
    removeNode(getAdopterByLocation(sheet, _this));
    removeAdopterLocation(sheet, _this);
  });

  _this._uniqueSheets = uniqueSheets;

  if (_this.isConnected()) {
    _this._adopt();
  }
};

/**
 * Runs the adoption algorithm: re-adds all the `<style>` adopters to the
 * location.
 */
proto._adopt = function _adopt() {
  var _this = this;
  var styleList = document.createDocumentFragment();
  var sheets = _this._uniqueSheets;
  var observer = _this._observer;
  var element =
    _this._element instanceof Document ? document.body : _this._element;

  // The operation of adding a `<style>` element to document fragment removes
  // that element from the location, so we need to pause watching when it
  // happens to avoid calling observer callback.
  observer.disconnect();

  sheets.forEach(function(sheet) {
    styleList.appendChild(
      getAdopterByLocation(sheet, _this) || addAdopterLocation(sheet, _this),
    );
  });

  // Inserting in the end of the location
  element.insertBefore(styleList, null);

  observer.observe(element, defaultObserverOptions);

  // Now we have all the sheets of `<style>` elements available (because
  // `_adopt` is not supposed to run while location is disconnected).
  sheets.forEach(function(sheet) {
    restyleAdopter(sheet, getAdopterByLocation(sheet, _this));
  });
};

/**
 * Checks if the element is an adopter that presents in the current set of
 * constructed style sheets.
 *
 * @param {Node} element
 * @return {boolean}
 * @private
 */
proto._isExistingAdopter = function _isExistingAdopter(element) {
  var _this = this;

  return (
    element instanceof HTMLStyleElement &&
    this._uniqueSheets.some(function(sheet) {
      return getAdopterByLocation(sheet, _this);
    })
  );
};

export default Location;
