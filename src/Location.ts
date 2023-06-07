import AdoptedStyleSheetsArray from './AdoptedStyleSheetsArray.js';
import type ConstructedStyleSheet from './ConstructedStyleSheet.js';
import {
  addAdopterLocation,
  getAdopterByLocation,
  isNonConstructedStyleSheetInstance,
  removeAdopterLocation,
  restyleAdopter,
} from './ConstructedStyleSheet.js';
import { hasShadyCss } from './shared.js';
import {
  diff,
  getShadowRoot,
  isElementConnected,
  removeNode,
  unique,
} from './utils.js';

const defaultObserverOptions: MutationObserverInit = {
  childList: true,
  subtree: true,
};

const locations = new WeakMap<Document | ShadowRoot, Location>();

/**
 * Searches for the location associated with the element. If no location found,
 * creates a new one and adds it to the registry.
 */
export function getAssociatedLocation(
  element: Document | ShadowRoot,
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
): void {
  Object.defineProperty(constructor.prototype, 'adoptedStyleSheets', {
    configurable: true,
    enumerable: true,
    get(): ConstructedStyleSheet[] {
      return getAssociatedLocation(this).sheets;
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

export default class Location {
  /**
   * A list of constructable style sheets added to the current location via
   * `adoptedStyleSheets` property.
   */
  readonly #element: Document | ShadowRoot;
  readonly #observer: MutationObserver;
  #sheets = new AdoptedStyleSheetsArray(this);
  #uniqueSheets: readonly ConstructedStyleSheet[] = [];

  constructor(element: Document | ShadowRoot) {
    this.#element = element;
    this.#observer = new MutationObserver((mutations, observer) => {
      // Workaround for
      // https://github.com/calebdwilliams/construct-style-sheets/pull/63
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!document) {
        observer.disconnect();
        return;
      }

      mutations.forEach((mutation) => {
        if (!hasShadyCss) {
          // When the new custom element is added to the observing location, we
          // need to connect all web components. However, since any added node
          // may contain custom elements deeply nested we need to explore the
          // whole tree.
          Array.prototype.forEach.call(mutation.addedNodes, (node: Node) => {
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
        Array.prototype.forEach.call(mutation.removedNodes, (node: Node) => {
          if (!(node instanceof Element)) {
            return;
          }

          if (this.#isExistingAdopter(node)) {
            this.#adopt();
          }

          // We have to stop observers for disconnected nodes.
          if (!hasShadyCss) {
            traverseWebComponents(node, (root) => {
              getAssociatedLocation(root).disconnect();
            });
          }
        });
      });
    });
  }

  get sheets(): ConstructedStyleSheet[] {
    return this.#sheets;
  }

  /**
   * An element that serves as a container for `<style>` adopters. For
   * Document, it is `document.body`, for ShadowRoot - the ShadowRoot itself.
   */
  get #adopterContainer(): Element | ShadowRoot {
    return this.#element instanceof Document
      ? this.#element.body
      : this.#element;
  }

  /**
   * The `connectedCallback` method for a location. Runs when the location is
   * connected to the DOM.
   */
  connect(): void {
    this.#observer.observe(this.#adopterContainer, defaultObserverOptions);

    if (this.#uniqueSheets.length > 0) {
      this.#adopt();
    }

    traverseWebComponents(this.#adopterContainer, (root) => {
      getAssociatedLocation(root).connect();
    });
  }

  /**
   * The `disconnectedCallback` method for a location. Runs when the location is
   * disconnected from the DOM.
   */
  disconnect(): void {
    this.#observer.disconnect();
  }

  /**
   * Checks if the current location is connected to the DOM.
   */
  isConnected(): boolean {
    return this.#element instanceof Document
      ? this.#element.readyState !== 'loading'
      : isElementConnected(this.#element.host);
  }

  update(sheets: AdoptedStyleSheetsArray): void {
    const locationType = this.#element === document ? 'Document' : 'ShadowRoot';

    if (!sheets.every((sheet) => sheet instanceof CSSStyleSheet)) {
      // document.adoptedStyleSheets.push('non-CSSStyleSheet value');
      throw new TypeError(
        `Failed to add to the 'adoptedStyleSheets' property on ${locationType}: Failed to convert value to 'CSSStyleSheet'`,
      );
    }

    if (sheets.some(isNonConstructedStyleSheetInstance)) {
      // document.adoptedStyleSheets.push(document.styleSheets[0]);
      throw new TypeError(
        `Failed to set the 'adoptedStyleSheets' property on ${locationType}: Can't adopt non-constructed stylesheets`,
      );
    }

    this.#sheets = sheets;
    const oldUniqueSheets = this.#uniqueSheets;
    const uniqueSheets = unique<ConstructedStyleSheet>(sheets);

    // Style sheets that existed in the old sheet list but was excluded in the
    // new one.
    const removedSheets = diff(oldUniqueSheets, uniqueSheets);

    removedSheets.forEach((sheet) => {
      // Type Note: any removed sheet is already initialized, so there cannot be
      // missing adopter for this location.
      removeNode(sheet[getAdopterByLocation](this)!);
      sheet[removeAdopterLocation](this);
    });

    this.#uniqueSheets = uniqueSheets;

    if (this.isConnected() && uniqueSheets.length > 0) {
      this.#adopt();
    }
  }

  /**
   * Runs the adoption algorithm: re-adds all the `<style>` adopters to the
   * location.
   */
  #adopt(): void {
    const styleList = document.createDocumentFragment();
    const sheets = this.#uniqueSheets;
    const observer = this.#observer;

    // Adding a `<style>` element to document fragment removes that element from
    // the location, so we need to pause watching when it happens to avoid calling
    // observer callback.
    observer.disconnect();

    sheets.forEach((sheet) => {
      styleList.appendChild(
        sheet[getAdopterByLocation](this) ?? sheet[addAdopterLocation](this),
      );
    });

    // Inserting in the end of the location
    this.#adopterContainer.insertBefore(styleList, null);

    // Re-start the observation.
    observer.observe(this.#adopterContainer, defaultObserverOptions);

    // Now we have all the sheets of `<style>` elements available (because
    // `adopt` is not supposed to run while location is disconnected).
    sheets.forEach((sheet) => {
      // Mote: we just defined adopter above.
      sheet[restyleAdopter](sheet[getAdopterByLocation](this)!);
    });
  }

  /**
   * Checks if the element is an adopter that presents in the current set of
   * constructed style sheets.
   */
  #isExistingAdopter(element: Node): boolean {
    return (
      element instanceof HTMLStyleElement &&
      this.#uniqueSheets.some((sheet) => sheet[getAdopterByLocation](this))
    );
  }
}
