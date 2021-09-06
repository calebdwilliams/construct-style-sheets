import type Location from './Location';
import {_DOMException, bootstrapper, isSafari} from './shared';
import {
  clearRules,
  defineProperty,
  fixSafariBrokenRules,
  insertAllRules,
  rejectImports,
} from './utils';

const cssStyleSheetMethods = [
  'addImport',
  'addPageRule',
  'addRule',
  'deleteRule',
  'insertRule',
  'removeImport',
  'removeRule',
];

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

export function isCSSStyleSheetInstance(instance: object): boolean {
  return typeof instance === 'object'
    ? proto.isPrototypeOf(instance) ||
        nonConstructedProto.isPrototypeOf(instance)
    : false;
}

export function isNonConstructedStyleSheetInstance(instance: object): boolean {
  return typeof instance === 'object'
    ? nonConstructedProto.isPrototypeOf(instance)
    : false;
}

/*
 * Private properties
 */

/**
 * Basic stylesheet is an sample stylesheet that contains all the CSS rules of
 * the current constructable stylesheet. The document or custom elements can
 * adopt constructable stylesheet; in this case, basic stylesheet's CSS rules
 * are reflected in document/custom element internal <style> elements.
 */
const $basicStyleSheet = new WeakMap<ConstructedStyleSheet, CSSStyleSheet>();

/**
 * Contains all locations associated with the current ConstructedStyleSheet.
 */
const $locations = new WeakMap<ConstructedStyleSheet, Location[]>();

/**
 * Adopter is a `<style>` element that belongs to the document or a custom
 * element and contains the content of the basic stylesheet.
 *
 * This property contains a map of `<style>` adopter associated with locations.
 */
const $adoptersByLocation = new WeakMap<
  ConstructedStyleSheet,
  WeakMap<Location, HTMLStyleElement>
>();

/*
 * Package-level control functions
 */

export function addAdopterLocation(
  sheet: ConstructedStyleSheet,
  location: Location,
): HTMLStyleElement {
  const adopter = document.createElement('style');
  $adoptersByLocation.get(sheet)!.set(location, adopter);
  $locations.get(sheet)!.push(location);

  return adopter;
}

export function getAdopterByLocation(
  sheet: ConstructedStyleSheet,
  location: Location,
): HTMLStyleElement | undefined {
  return $adoptersByLocation.get(sheet)!.get(location);
}

export function removeAdopterLocation(
  sheet: ConstructedStyleSheet,
  location: Location,
): void {
  $adoptersByLocation.get(sheet)!.delete(location);
  $locations.set(
    sheet,
    $locations.get(sheet)!.filter((_location) => _location !== location),
  );
}

/**
 * Re-styles a single `<style>` adopter according to the basic style sheet.
 *
 * NOTE: don't use it for disconnected adopters. It will throw an error.
 */
export function restyleAdopter(
  sheet: ConstructedStyleSheet,
  adopter: HTMLStyleElement,
): void {
  requestAnimationFrame(() => {
    clearRules(adopter.sheet!);
    insertAllRules($basicStyleSheet.get(sheet)!, adopter.sheet!);
  });
}

/*
 * Private methods
 */

/**
 * This method checks if the method of the class is called correctly using the
 * CSSStyleSheet instance. It is necessary to be sure that all private
 * properties are initialized.
 */
function checkInvocationCorrectness(self: ConstructedStyleSheet) {
  if (!$basicStyleSheet.has(self)) {
    throw new TypeError('Illegal invocation');
  }
}

/**
 * A replacement for CSSStyleSheet class which is not actually constructable in
 * any browser that does not support Constructable Style Sheet proposal. To
 * fulfil the Constructable Style Sheet specification, it preserves a separate
 * HTMLStyleElement that behaves as a backup for all the `<style>` adopters.
 */
declare class ConstructedStyleSheet extends CSSStyleSheet {
  replace(text: string): Promise<ConstructedStyleSheet>;
  replaceSync(text: string): void;
}

function ConstructedStyleSheet(this: ConstructedStyleSheet) {
  const self = this;
  const style = document.createElement('style');
  bootstrapper.body.appendChild(style);

  // Init private properties
  $basicStyleSheet.set(self, style.sheet!);
  $locations.set(self, []);
  $adoptersByLocation.set(self, new WeakMap());
}

const proto = ConstructedStyleSheet.prototype;

proto.replace = function replace(
  contents: string,
): Promise<ConstructedStyleSheet> {
  try {
    this.replaceSync(contents);

    return Promise.resolve(this);
  } catch (e) {
    return Promise.reject(e);
  }
};

proto.replaceSync = function replaceSync(contents) {
  // CSSStyleSheet.prototype.replaceSync('body {}')
  checkInvocationCorrectness(this);

  if (typeof contents === 'string') {
    const self = this;

    const style = $basicStyleSheet.get(self)!.ownerNode as HTMLStyleElement;
    style.textContent = rejectImports(contents);
    $basicStyleSheet.set(self, style.sheet!);

    if (isSafari) {
      fixSafariBrokenRules(style.sheet!, style.textContent!);
    }

    $locations.get(self)!.forEach((location) => {
      if (location.isConnected()) {
        // Type Note: if location is connected, adopter is already created.
        restyleAdopter(self, getAdopterByLocation(self, location)!);
      }
    });
  }
};

defineProperty(proto, 'cssRules', {
  configurable: true,
  enumerable: true,
  get: function cssRules() {
    // CSSStyleSheet.prototype.cssRules;
    checkInvocationCorrectness(this);

    return $basicStyleSheet.get(this)!.cssRules;
  },
});

cssStyleSheetMethods.forEach((method) => {
  proto[method] = function () {
    const self = this;
    checkInvocationCorrectness(self);

    const args = arguments;
    const basic = $basicStyleSheet.get(self)!;
    const locations = $locations.get(self)!;

    const result = basic[method].apply(basic, args);

    if (isSafari && method === 'insertRule') {
      fixSafariBrokenRules(basic, args[0]);
    }

    locations.forEach((location) => {
      if (location.isConnected()) {
        // Type Note: If location is connected, adopter is already created; and
        // since it is connected to DOM, the sheet cannot be null.
        const sheet = getAdopterByLocation(self, location)!.sheet!;
        sheet[method].apply(sheet, args);
      }
    });

    return result;
  };
});

defineProperty(ConstructedStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: isCSSStyleSheetInstance,
});

export default ConstructedStyleSheet;
