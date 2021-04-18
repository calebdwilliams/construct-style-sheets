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
 * @param {Node} node
 * @param {function(node: ShadowRoot): void} callback
 * @return {NodeIterator}
 */
function traverseWebComponents(node, callback) {
  var iter = document.createNodeIterator(
    node,
    NodeFilter.SHOW_ELEMENT,
    function(foundNode) {
      return getShadowRoot(foundNode)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
    // IE createNodeIterator method accepts 5 args
    null,
    false,
  );

  for (var next; (next = iter.nextNode()); ) {
    callback(getShadowRoot(next));
  }
}

/*
 * Private properties
 */

/**
 * A root element (either ShadowRoot or Document) that has the
 * `adoptedStyleSheets` property set.
 *
 * @type {WeakMap<Location, ShadowRoot|Document>}
 */
var $element = new WeakMap();

/**
 * A result of [...new Set(...this.sheets)] operation.
 *
 * @type {WeakMap<Location, ReadonlyArray<ConstructedStyleSheet>>}
 * @private
 */
var $uniqueSheets = new WeakMap();

/**
 * An observer that adds and restores `<style>` adopters to the location
 * element. It also runs a `connect` for a location associated with the added
 * element, and a `disconnect` function for a location of removed element.
 *
 * @type {WeakMap<Location, MutationObserver>}
 */
var $observer = new WeakMap();

/*
 * Private methods
 */
/**
 * Checks if the element is an adopter that presents in the current set of
 * constructed style sheets.
 *
 * @param {Location} self
 * @param {Node} element
 * @return {boolean}
 */
function isExistingAdopter(self, element) {
  return (
    element instanceof HTMLStyleElement &&
    $uniqueSheets.get(self).some(function(sheet) {
      return getAdopterByLocation(sheet, self);
    })
  );
}

/**
 * Gets an element that serves as a container for `<style>` adopters. For
 * Document, it is `document.body`, for ShadowRoot - the ShadowRoot itself.
 *
 * @param {Location} self
 */
function getAdopterContainer(self) {
  var element = $element.get(self);

  return element instanceof Document ? element.body : element;
}

/**
 * Runs the adoption algorithm: re-adds all the `<style>` adopters to the
 * location.
 *
 * @param {Location} self
 */
function adopt(self) {
  var styleList = document.createDocumentFragment();
  var sheets = $uniqueSheets.get(self);
  var observer = $observer.get(self);
  var container = getAdopterContainer(self);

  // The operation of adding a `<style>` element to document fragment removes
  // that element from the location, so we need to pause watching when it
  // happens to avoid calling observer callback.
  observer.disconnect();

  sheets.forEach(function(sheet) {
    styleList.appendChild(
      getAdopterByLocation(sheet, self) || addAdopterLocation(sheet, self),
    );
  });

  // Inserting in the end of the location
  container.insertBefore(styleList, null);

  observer.observe(container, defaultObserverOptions);

  // Now we have all the sheets of `<style>` elements available (because
  // `adopt` is not supposed to run while location is disconnected).
  sheets.forEach(function(sheet) {
    restyleAdopter(sheet, getAdopterByLocation(sheet, self));
  });
}

/**
 * @constructor
 * @param {ShadowRoot|Document} element
 * @private
 */
function Location(element) {
  var self = this;

  /**
   * A list of constructable style sheets added to the current location via
   * `adoptedStyleSheets` property.
   *
   * @type {ReadonlyArray<ConstructedStyleSheet>}
   */
  self.sheets = [];
  self.element = element;

  // Initialize private properties
  $element.set(self, element);
  $uniqueSheets.set(self, []);
  $observer.set(
    self,
    new MutationObserver(function(mutations, observer) {
      // Workaround for https://github.com/calebdwilliams/construct-style-sheets/pull/63
      if (!document) {
        observer.disconnect();
        return;
      }

      mutations.forEach(function(mutation) {
        if (!hasShadyCss) {
          // When the new custom element is added to the observing location, we
          // need to adopt its style sheets. However, since any added node may
          // contain deeply nested custom elements we need to explore the whole
          // tree.
          // NOTE: `mutation.addedNodes` is not an array; that's why for loop is
          // used.
          for (var i = 0; i < mutation.addedNodes.length; i++) {
            traverseWebComponents(mutation.addedNodes[i], function(root) {
              getAssociatedLocation(root).connect();
            });
          }
        }

        // When any `<style>` adopter is removed, we need to re-adopt all the
        // styles because otherwise we can break the order of appended styles
        // which affects the rules overriding.
        // NOTE: `mutation.removedNodes` is not an array; that's why for loop is
        // used.
        for (i = 0; i < mutation.removedNodes.length; i++) {
          var node = mutation.removedNodes[i];

          if (isExistingAdopter(self, node)) {
            adopt(self);
          }

          // We have to stop observers for disconnected nodes.
          if (!hasShadyCss) {
            traverseWebComponents(node, function(root) {
              getAssociatedLocation(root).disconnect();
            });
          }
        }
      });
    }),
  );
}

var proto = Location.prototype;

/**
 * Checks if the current location is connected to the DOM.
 *
 * @returns {boolean}
 */
proto.isConnected = function isConnected() {
  var element = $element.get(this);

  return element instanceof Document
    ? element.readyState !== 'loading'
    : isElementConnected(element.host);
};

/**
 * The `connectedCallback` method for a location. Runs when the location is
 * connected to the DOM.
 */
proto.connect = function connect() {
  var container = getAdopterContainer(this);

  $observer.get(this).observe(container, defaultObserverOptions);

  if ($uniqueSheets.get(this).length > 0) {
    adopt(this);
  }

  traverseWebComponents(container, function(root) {
    getAssociatedLocation(root).connect();
  });
};

/**
 * The `disconnectedCallback` method for a location. Runs when the location is
 * disconnected from the DOM.
 */
proto.disconnect = function disconnect() {
  $observer.get(this).disconnect();
};

/**
 * Called when the new set of constructed style sheets is set to the
 * `adoptedStyleSheets` property of Document or ShadowRoot.
 *
 * @param {ReadonlyArray<ConstructedStyleSheet>} sheets
 */
proto.update = function update(sheets) {
  var self = this;
  var locationType =
    $element.get(self) === document ? 'Document' : 'ShadowRoot';

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

  self.sheets = sheets;
  var oldUniqueSheets = $uniqueSheets.get(self);
  var uniqueSheets = unique(sheets);

  // Style sheets that existed in the old sheet list but was excluded in the
  // new one.
  var removedSheets = diff(oldUniqueSheets, uniqueSheets);

  removedSheets.forEach(function(sheet) {
    removeNode(getAdopterByLocation(sheet, self));
    removeAdopterLocation(sheet, self);
  });

  $uniqueSheets.set(self, uniqueSheets);

  if (self.isConnected() && uniqueSheets.length > 0) {
    adopt(self);
  }
};

export default Location;
