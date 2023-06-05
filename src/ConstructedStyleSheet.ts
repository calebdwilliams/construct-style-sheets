import type Location from './Location.js';
import { _DOMException, bootstrapper, type UnknownFunction } from './shared.js';
import { rejectImports } from './utils.js';

const NonConstructedStyleSheet = CSSStyleSheet;
const nonConstructedProto = NonConstructedStyleSheet.prototype;

nonConstructedProto.replace = function () {
  // document.styleSheets[0].replace('body {}');
  return Promise.reject(
    new _DOMException("Can't call replace on non-constructed CSSStyleSheets."),
  );
};

nonConstructedProto.replaceSync = function () {
  // document.styleSheets[0].replaceSync('body {}');
  throw new _DOMException(
    "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
  );
};

export function isNonConstructedStyleSheetInstance(instance: unknown): boolean {
  return Object.prototype.isPrototypeOf.call(
    nonConstructedProto,
    instance as object,
  );
}

/*
 * Package-level control functions
 */
export const addAdopterLocation = Symbol();
export const restyleAdopter = Symbol();
export const getAdopterByLocation = Symbol();
export const removeAdopterLocation = Symbol();

type AppliedMethod<T> = (sheet: CSSStyleSheet) => T;

export default class ConstructedStyleSheet implements CSSStyleSheet {
  static {
    (
      [
        'cssRules',
        'disabled',
        'href',
        'media',
        'ownerNode',
        'ownerRule',
        'parentStyleSheet',
        'rules',
        'title',
        'type',
      ] as const
    ).forEach((prop) => {
      Object.defineProperty(ConstructedStyleSheet.prototype, prop, {
        configurable: true,
        get(this: ConstructedStyleSheet) {
          return this.#basicStyleElement.sheet![prop];
        },
        ...(prop === 'disabled'
          ? {
              set(this: ConstructedStyleSheet, value: boolean) {
                this.#basicStyleElement.disabled = value;
              },
            }
          : {}),
      });
    });

    (['addRule', 'insertRule', 'deleteRule', 'removeRule'] as const).forEach(
      (method) =>
        Object.defineProperty(ConstructedStyleSheet.prototype, method, {
          configurable: true,
          value(this: ConstructedStyleSheet, ...args: unknown[]): unknown {
            return this.#apply((sheet) =>
              (sheet[method] as UnknownFunction)(...args),
            );
          },
        }),
    );

    Object.defineProperty(ConstructedStyleSheet, Symbol.hasInstance, {
      configurable: true,
      value(instance: unknown) {
        return (
          Object.prototype.isPrototypeOf.call(
            ConstructedStyleSheet.prototype,
            instance as object,
          ) ||
          Object.prototype.isPrototypeOf.call(
            nonConstructedProto,
            instance as object,
          )
        );
      },
    });
  }

  declare addRule: (
    selector?: string,
    style?: string,
    index?: number,
  ) => number;

  declare cssRules: CSSRuleList;
  declare deleteRule: (index: number) => void;
  declare disabled: boolean;
  declare href: string | null;
  declare insertRule: (rule: string, index?: number) => number;
  declare media: MediaList;
  declare ownerNode: Element | ProcessingInstruction | null;
  declare ownerRule: CSSRule | null;
  declare parentStyleSheet: CSSStyleSheet | null;
  declare removeRule: (index?: number) => void;
  declare rules: CSSRuleList;
  declare title: string | null;
  declare type: string;
  /**
   * Adopter is a `<style>` element that belongs to the document or a custom
   * element and contains the content of the basic stylesheet.
   *
   * This property contains a map of `<style>` adopter associated with locations.
   */
  readonly #adoptersByLocation = new WeakMap<Location, HTMLStyleElement>();
  #appliedMethods: Array<AppliedMethod<unknown>> = [];
  /**
   * Basic style element is a sample element that contains all the CSS of the
   * current constructable stylesheet. The document or custom elements can
   * adopt constructable stylesheet; in this case, basic stylesheet's CSS is
   * reflected in document/custom element internal <style> elements.
   */
  readonly #basicStyleElement = document.createElement('style');
  /**
   * Contains all locations associated with the current ConstructedStyleSheet.
   */
  #locations: Location[] = [];

  constructor() {
    bootstrapper.body.appendChild(this.#basicStyleElement);
  }

  replace(contents: string): Promise<this> {
    try {
      this.replaceSync(contents);

      return Promise.resolve(this);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  replaceSync(contents: string): void {
    if (typeof contents === 'string') {
      this.#basicStyleElement.textContent = rejectImports(contents);
      this.#appliedMethods = [];

      this.#locations.forEach((location) => {
        if (location.isConnected()) {
          // Type Note: if location is connected, adopter is already created.
          this[restyleAdopter](this[getAdopterByLocation](location)!);
        }
      });
    }
  }

  [addAdopterLocation](location: Location): HTMLStyleElement {
    const adopter = document.createElement('style');
    this.#adoptersByLocation.set(location, adopter);
    this.#locations.push(location);

    return adopter;
  }

  [getAdopterByLocation](location: Location): HTMLStyleElement | undefined {
    return this.#adoptersByLocation.get(location);
  }

  [removeAdopterLocation](location: Location): void {
    this.#adoptersByLocation.delete(location);
    this.#locations = this.#locations.filter(
      (_location) => _location !== location,
    );
  }

  /**
   * Re-styles a single `<style>` adopter according to the basic style sheet.
   *
   * NOTE: don't use it for disconnected adopters. It will throw an error.
   */
  [restyleAdopter](adopter: HTMLStyleElement): void {
    requestAnimationFrame(() => {
      adopter.textContent = this.#basicStyleElement.textContent;
      this.#appliedMethods.forEach((callback) => callback(adopter.sheet!));
    });
  }

  #apply<T>(callback: AppliedMethod<T>): T {
    this.#appliedMethods.push(callback);

    this.#locations.forEach((location) => {
      if (location.isConnected()) {
        // Type Note: If location is connected, adopter is already created; and
        // since it is connected to DOM, the sheet cannot be null.
        callback(this[getAdopterByLocation](location)!.sheet!);
      }
    });

    return callback(this.#basicStyleElement.sheet!);
  }
}
