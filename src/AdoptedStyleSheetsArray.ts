import type ConstructedStyleSheet from './ConstructedStyleSheet.js';
import type Location from './Location.js';

const methods = ['pop', 'unshift', 'push', 'shift', 'sort'] as const;

export default function createObservableArray(
  location: Location,
): ConstructedStyleSheet[] {
  const arr: ConstructedStyleSheet[] = [];
  methods.reduce<Record<string, (...args: unknown[]) => unknown>>(
    (prototype, method) => {
      const m = prototype[method];
      prototype[method] = function (
        this: ConstructedStyleSheet[],
        ...args: unknown[]
      ) {
        const result = m.apply(this, args);
        location.update(this);
        return result;
      };
      return prototype;
    },
    Object.getPrototypeOf(arr),
  );

  return arr;
}
