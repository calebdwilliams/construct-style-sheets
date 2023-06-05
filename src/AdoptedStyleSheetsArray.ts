import type ConstructedStyleSheet from './ConstructedStyleSheet.js';
import type Location from './Location.js';
import type { UnknownFunction } from './shared.js';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdoptedStyleSheetsArray extends Array<ConstructedStyleSheet> {}

class AdoptedStyleSheetsArray {
  static {
    Object.setPrototypeOf(
      AdoptedStyleSheetsArray.prototype,
      (['pop', 'unshift', 'push', 'shift', 'sort'] as const).reduce(
        (proto, method) => {
          const m = proto[method] as UnknownFunction;
          Object.defineProperty(proto, method, {
            configurable: true,
            value(this: AdoptedStyleSheetsArray, ...args: unknown[]) {
              const result = m.apply(this, args);
              this.#location.update(this);
              return result;
            },
          });
          return proto;
        },
        [] as ConstructedStyleSheet[],
      ),
    );
  }

  #location: Location;

  constructor(location: Location) {
    this.#location = location;
  }
}

export default AdoptedStyleSheetsArray;
