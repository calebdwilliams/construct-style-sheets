import type ConstructedStyleSheet from './ConstructedStyleSheet';
import {
  addAdopterLocation,
  getAdopterByLocation,
  isCSSStyleSheetInstance,
  isNonConstructedStyleSheetInstance,
  removeAdopterLocation,
  restyleAdopter,
} from './ConstructedStyleSheet';
import {defineProperty, forEach, hasShadyCss} from './shared';
import {
  diff,
  getShadowRoot,
  isElementConnected,
  removeNode,
  unique,
} from './utils';

const defaultObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};

const locations = new WeakMap<ShadowRoot | Document, Location>();

/**
 * Searches for the location associated with the element. If no location found,
 * creates a new one and adds it to the registry.
 */
export function getAssociatedLocation(
  element: ShadowRoot | Document,
): Location {
  let location = locations.get(element);

  if (!location) {
    location = new Location(element);
    locations.set(element, location);
  }

  return location;
}

/**
 * Adds an `adoptedStyleSheets` accessors for the received class prototype.
 */
export function attachAdoptedStyleSheetProperty(
  constructor: typeof Document | typeof ShadowRoot,
) {
  defineProperty(constructor.prototype, 'adoptedStyleSheets', {
    configurable: true,
    enumerable: true,
    get(): readonly ConstructedStyleSheet[] {
      return getAssociatedLocation(this).sheets;
    },
    set(sheets: readonly ConstructedStyleSheet[]) {
      getAssociatedLocation(this).update(sheets);
    },
  });
}

/**
 * Traverses through the node's subtree in order to find web components with
 * Shadow DOM initialized and runs a `callback` for their ShadowRoot.
 */
function traverseWebComponents(
  node: Node,
  callback: (node: ShadowRoot) => void,
): void {
  const iter = document.createNodeIterator(
    node,
    NodeFilter.SHOW_ELEMENT,
    (foundNode: Element) =>
      getShadowRoot(foundNode)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
    // @ts-expect-error: IE createNodeIterator method accepts 5 args
    null,
    false,
  );

  for (let next: Node | null; (next = iter.nextNode()); ) {
    // Type Note: we already checked for ShadowRoot above
    callback(getShadowRoot(next as Element)!);
  }
}

/*
 * Private properties
 */

/**
 * A root element (either ShadowRoot or Document) that has the
 * `adoptedStyleSheets` property set.
 */
const $element = new WeakMap<Location, ShadowRoot | Document>();

/**
 * A result of [...new Set(...this.sheets)] operation.
 */
const $uniqueSheets = new WeakMap<Location, readonly ConstructedStyleSheet[]>();

/**
 * An observer that adds and restores `<style>` adopters to the location
 * element. It also runs a `connect` for a location associated with the added
 * element, and a `disconnect` function for a location of removed element.
 */
const $observer = new WeakMap<Location, MutationObserver>();

/*
 * Private methods
 */
/**
 * Checks if the element is an adopter that presents in the current set of
 * constructed style sheets.
 */
function isExistingAdopter(self: Location, element: Node): boolean {
  return (
    element instanceof HTMLStyleElement &&
    $uniqueSheets.get(self)!.some((sheet) => getAdopterByLocation(sheet, self))
  );
}

/**
 * Gets an element that serves as a container for `<style>` adopters. For
 * Document, it is `document.body`, for ShadowRoot - the ShadowRoot itself.
 */
function getAdopterContainer(self: Location): Element | ShadowRoot {
  const element = $element.get(self)!;

  return element instanceof Document ? element.body : element;
}

/**
 * Runs the adoption algorithm: re-adds all the `<style>` adopters to the
 * location.
 */
function adopt(self: Location): void {
  const styleList = document.createDocumentFragment();
  const sheets = $uniqueSheets.get(self)!;
  const observer = $observer.get(self)!;
  const container = getAdopterContainer(self);

  // Adding a `<style>` element to document fragment removes that element from
  // the location, so we need to pause watching when it happens to avoid calling
  // observer callback.
  observer.disconnect();

  sheets.forEach((sheet) => {
    styleList.appendChild(
      getAdopterByLocation(sheet, self) || addAdopterLocation(sheet, self),
    );
  });

  // Inserting in the end of the location
  container.insertBefore(styleList, null);

  // Re-start the observation.
  observer.observe(container, defaultObserverOptions);

  // Now we have all the sheets of `<style>` elements available (because
  // `adopt` is not supposed to run while location is disconnected).
  sheets.forEach((sheet) => {
    // Mote: we just defined adopter above.
    restyleAdopter(sheet, getAdopterByLocation(sheet, self)!);
  });
}

/**
 * A wrapper for any element that is allowed to set the `adoptedStyleSheets`
 * property. Watches its internal DOM for new elements; when they appear, it
 * connects them by adding a `<style>` adopters that provides all the styles
 * from the applied ConstructedStyleSheets instances.
 */
declare class Location {
  /**
   * A list of constructable style sheets added to the current location via
   * `adoptedStyleSheets` property.
   */
  public sheets: readonly ConstructedStyleSheet[];

  constructor(element: Document | ShadowRoot);

  /**
   * The `connectedCallback` method for a location. Runs when the location is
   * connected to the DOM.
   */
  connect(): void;

  /**
   * The `disconnectedCallback` method for a location. Runs when the location is
   * disconnected from the DOM.
   */
  disconnect(): void;

  /**
   * Checks if the current location is connected to the DOM.
   */
  isConnected(): boolean;

  /**
   * Called when the new set of constructed style sheets is set to the
   * `adoptedStyleSheets` property of Document or ShadowRoot.
   */
  update(sheets: readonly ConstructedStyleSheet[]): void;
}

function Location(this: Location, element: Document | ShadowRoot) {
  const self = this;
  self.sheets = [];

  // Initialize private properties
  $element.set(self, element);
  $uniqueSheets.set(self, []);
  $observer.set(
    self,
    new MutationObserver((mutations, observer) => {
      // Workaround for
      // https://github.com/calebdwilliams/construct-style-sheets/pull/63
      if (typeof document === 'undefined') {
        observer.disconnect();
        return;
      }

      mutations.forEach((mutation) => {
        if (!hasShadyCss) {
          // When the new custom element is added to the observing location, we
          // need to connect all web components. However, since any added node
          // may contain custom elements deeply nested we need to explore the
          // whole tree.
          forEach.call(mutation.addedNodes, (node: Node) => {
            if (!(node instanceof Element)) {
              return;
            }

            traverseWebComponents(node, (root) => {
              getAssociatedLocation(root).connect();
            });
          });
        }

        // When any `<style>` adopter is removed, we need to re-adopt all the
        // styles because otherwise we can break the order of appended styles
        // which affects the rules overriding.
        forEach.call(mutation.removedNodes, (node: Node) => {
          if (!(node instanceof Element)) {
            return;
          }

          if (isExistingAdopter(self, node)) {
            adopt(self);
          }

          // We have to stop observers for disconnected nodes.
          if (!hasShadyCss) {
            traverseWebComponents(node, (root) => {
              getAssociatedLocation(root).disconnect();
            });
          }
        });
      });
    }),
  );
}

// @ts-expect-error: too generic for TypeScript
Location.prototype = {
  isConnected() {
    const element = $element.get(this)!;

    return element instanceof Document
      ? element.readyState !== 'loading'
      : isElementConnected(element.host);
  },
  connect() {
    const container = getAdopterContainer(this);

    $observer.get(this)!.observe(container, defaultObserverOptions);

    if ($uniqueSheets.get(this)!.length > 0) {
      adopt(this);
    }

    traverseWebComponents(container, (root) => {
      getAssociatedLocation(root).connect();
    });
  },
  disconnect() {
    $observer.get(this)!.disconnect();
  },
  update(sheets: readonly ConstructedStyleSheet[]) {
    const self = this;
    const locationType =
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
    const oldUniqueSheets = $uniqueSheets.get(self)!;
    const uniqueSheets = unique(sheets);

    // Style sheets that existed in the old sheet list but was excluded in the
    // new one.
    const removedSheets = diff(oldUniqueSheets, uniqueSheets);

    removedSheets.forEach((sheet) => {
      // Type Note: any removed sheet is already initialized, so there cannot be
      // missing adopter for this location.
      removeNode(getAdopterByLocation(sheet, self)!);
      removeAdopterLocation(sheet, self);
    });

    $uniqueSheets.set(self, uniqueSheets);

    if (self.isConnected() && uniqueSheets.length > 0) {
      adopt(self);
    }
  },
};

export default Location;
