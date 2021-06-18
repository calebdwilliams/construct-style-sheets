let defineCECounter = 0;

/**
 * Registers a new element with an automatically generated unique name.
 * Helps to make a test fully isolated.
 *
 * @example
 * const tag = defineCE(class extends MyMixin(HTMLElement) {
 *   // define custom element class body
 * });
 * const el = fixture(`<${tag}></${tag}>`);
 * // test el
 *
 * @see https://github.com/open-wc/open-wc/blob/bdee8bd67763b8cd68784128df1d5f10ce40bc96/packages/testing-helpers/src/helpers.js
 */
export function defineCE(klass: CustomElementConstructor) {
  const tag = `test-${defineCECounter}`;
  customElements.define(tag, klass);
  defineCECounter += 1;
  return tag;
}

const cachedWrappers: Node[] = [];

/**
 * Creates a wrapper as a direct child of `<body>` to put the tested element into.
 * Need to be in the DOM to test for example `connectedCallback()` on elements.
 *
 * @see https://github.com/open-wc/open-wc/blob/bdee8bd67763b8cd68784128df1d5f10ce40bc96/packages/testing-helpers/src/fixtureWrapper.js
 */
function fixtureWrapper(
  parentNode: Element = document.createElement('div'),
): Element {
  document.body.appendChild(parentNode);
  cachedWrappers.push(parentNode);
  return parentNode;
}

/**
 * Setups an element synchronously from the provided string template and puts it in the DOM.
 * Allows to specify properties via an object or a function taking the element as an argument.
 *
 * @see https://github.com/open-wc/open-wc/blob/bdee8bd67763b8cd68784128df1d5f10ce40bc96/packages/testing-helpers/src/stringFixture.js
 */
export async function fixture<T extends Element>(template: string): Promise<T> {
  const parentNode = fixtureWrapper();
  parentNode.innerHTML = template;

  await waitForMutationObserver();

  return parentNode.children[0] as T;
}

/**
 * MutationObserver is asynchronous but we unable to initialize connected
 * element without it. So we need to wait for update.
 *
 * The element-based approach is necessary for IE where the Promise polyfill
 * does not work correctly, so we cannot just use Promise.resolve().
 *
 * @param element
 */
export async function waitForMutationObserver(
  element?: Element,
): Promise<void> {
  return element
    ? new Promise((resolve, reject) => {
        try {
          let observer: MutationObserver;

          const cb = () => {
            observer.disconnect();
            resolve();
          };

          observer = new MutationObserver(cb);
          observer.observe(element, {childList: true, subtree: true});
        } catch (e) {
          reject(e);
        }
      })
    : Promise.resolve();
}
