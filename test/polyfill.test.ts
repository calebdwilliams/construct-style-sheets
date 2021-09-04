import {defineCE, fixture, waitForMutationObserver} from './helpers';

// if (!('adoptedStyleSheets' in document)) {
//   // @ts-expect-error: TS complains because it is a new version feature but
//   // this part is erased by Rollup during tests so it's ok.
//   await import('../src/index');
// }

// Workaround for IE that does not support the DOMException constructor
export const _DOMException =
  typeof DOMException === 'object' ? Error : DOMException;

type ShadowCSSChecker = Record<string, string>;

// @ts-expect-error: requestAnimationFrame is hard to await, so we just replace
// it with instant function call.
window.requestAnimationFrame = (callback) => callback();

describe('Constructible Style Sheets polyfill', () => {
  describe('CSSStyleSheet object', () => {
    const importPatterns = [
      "@import 'foo.css'",
      '@import "foo.css";',
      "@import url('foo.css')",
      '@import url("foo.css");',
    ];

    let globalStyle: HTMLStyleElement;
    let sheet: CSSStyleSheet;

    beforeEach(() => {
      sheet = new CSSStyleSheet();
    });

    beforeEach(() => {
      globalStyle = document.createElement('style');
      globalStyle.innerHTML = '.only-test { color: red; }';
      document.body.appendChild(globalStyle);
    });

    afterEach(() => {
      globalStyle.parentNode!.removeChild(globalStyle);
    });

    describe('basic', () => {
      it('has replace and replaceSync methods', () => {
        expect(sheet.cssRules).toBeDefined();
        expect(sheet.replace).toBeDefined();
        expect(sheet.replaceSync).toBeDefined();
      });

      it('passes instanceof checks', () => {
        expect(sheet instanceof CSSStyleSheet).toBeTruthy();

        const style = document.createElement('style');
        document.body.appendChild(style);
        expect(style.sheet instanceof CSSStyleSheet).toBeTruthy();
      });
    });

    describe('illegal invocation', () => {
      const illegalPattern = /Illegal invocation/i;

      const checkIllegalInvocation = (method) => {
        expect(CSSStyleSheet.prototype[method]).toThrowError(illegalPattern);
      };

      describe('occurs for sync methods when they are improperly invoked', () => {
        it('deleteRule', () => {
          checkIllegalInvocation('deleteRule');
        });

        it('insertRule', () => {
          checkIllegalInvocation('insertRule');
        });

        it('replaceSync', () => {
          checkIllegalInvocation('replaceSync');
        });
      });

      describe('occurs for async methods when they are improperly invoked', () => {
        it('replace', async () => {
          await expectAsync(
            CSSStyleSheet.prototype.replace(''),
          ).toBeRejectedWithError(illegalPattern);
        });
      });

      describe('occurs for accessor methods when they are improperly invoked', () => {
        it('cssRules', () => {
          expect(() => CSSStyleSheet.prototype.cssRules).toThrowError(
            illegalPattern,
          );
        });
      });
    });

    describe('replace', () => {
      let result: Promise<CSSStyleSheet>;

      beforeEach(() => {
        result = sheet.replace('* { color: tomato; }');
      });

      it('returns a promise that resolves to a sheet', async () => {
        expect(result instanceof Promise).toBe(true);

        const resolved = await result;

        // Use toBe because there should be referential integrity
        expect(resolved).toBe(sheet);
      });

      it('has a rule set', async () => {
        const updatedSheet = await result;
        expect(updatedSheet.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if it is called not from a non-constructed CSSStyleSheet', async () => {
        await expectAsync(
          globalStyle.sheet!.replace('.only-test { color: blue; }'),
        ).toBeRejectedWith(
          new _DOMException(
            "Can't call replace on non-constructed CSSStyleSheets.",
          ),
        );
      });

      it('removes @import statements', async () => {
        return await Promise.all(
          importPatterns.map((pattern) =>
            sheet.replace(pattern).then(() => {
              expect(sheet.cssRules.length).toBe(0);
            }),
          ),
        );
      });

      it('correctly replaces multi-rule styles', async () => {
        await expectAsync(
          sheet.replace(`
              h1 { color: tomato; }
              h2 { color: tomato; }
            `),
        ).not.toBeRejected();
      });
    });

    describe('replaceSync', () => {
      beforeEach(() => {
        sheet.replaceSync('* { color: tomato; }');
      });

      it('has a rule set', async () => {
        expect(sheet.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if it is called not from a CSSStyleSheet', () => {
        expect(() => {
          globalStyle.sheet!.replaceSync('.only-test { color: blue; }');
        }).toThrow(
          new _DOMException(
            "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
          ),
        );
      });

      it('removes @import statements', () => {
        importPatterns.forEach((pattern) => {
          sheet.replaceSync(pattern);
          expect(sheet.cssRules.length).toBe(0);
        });
      });

      it('correctly replaces multi-rule styles', async () => {
        await expect(() =>
          sheet.replaceSync(`
            h1 { color: tomato; }
            h2 { color: tomato; }
          `),
        ).not.toThrowError();
      });
    });
  });

  describe('Web Components', () => {
    let shadowRootRegistry: WeakMap<Element, ShadowRoot>;

    beforeEach(() => {
      shadowRootRegistry = new WeakMap();
      // We don't support web components in Edge or IE
      if (!('ShadowRoot' in window)) {
        pending();
      }
    });

    type CustomElementOptions = Readonly<{
      html?: string;
      mode?: ShadowRootMode;
    }>;

    const createCustomElement = (
      sheets?: readonly CSSStyleSheet[],
      {html = '', mode = 'open'}: CustomElementOptions = {},
    ): [tag: string, klass: object] => {
      class CustomElement extends HTMLElement {
        constructor() {
          super();
          const root = this.attachShadow({mode});
          shadowRootRegistry.set(this, root);

          if (sheets) {
            root.adoptedStyleSheets = sheets;
          }

          root.innerHTML = html;
        }
      }

      return [defineCE(CustomElement), CustomElement];
    };

    const checkShadowCss = (
      element: Element,
      positiveChecker: ShadowCSSChecker | undefined,
      negativeChecker?: ShadowCSSChecker,
    ) => {
      const test = document.createElement('div');
      test.classList.add('test');
      shadowRootRegistry.get(element)!.appendChild(test);

      const computed = getComputedStyle(test, null);

      for (const property in positiveChecker) {
        expect(computed.getPropertyValue(property)).toBe(
          positiveChecker[property],
        );
      }

      for (const property in negativeChecker) {
        expect(computed.getPropertyValue(property)).not.toBe(
          negativeChecker[property],
        );
      }
    };

    let css: CSSStyleSheet;
    let defaultChecker: ShadowCSSChecker;

    beforeEach(() => {
      css = new CSSStyleSheet();
      css.replaceSync('.test { width: 53px; height: 91px; }');
      defaultChecker = {width: '53px', height: '91px'};
    });

    it('applies styling to web component', async () => {
      const [tag] = createCustomElement([css]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkShadowCss(element, defaultChecker);
    });

    it('can accept more than 1 style sheet', async () => {
      const css2 = new CSSStyleSheet();
      await css2.replace('.test { line-height: 35px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkShadowCss(element, {...defaultChecker, 'line-height': '35px'});
    });

    it('handles rules overriding properly', async () => {
      const css2 = new CSSStyleSheet();
      await css2.replace('.test { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkShadowCss(element, {...defaultChecker, height: '82px'});
    });

    it('restores styles if innerHTML is cleared', async () => {
      const [tag] = createCustomElement([css]);
      const element = await fixture(`<${tag}></${tag}>`);
      element.shadowRoot!.innerHTML = '';

      await waitForMutationObserver();

      checkShadowCss(element, defaultChecker);
    });

    it('provides proper rule overriding if innerHTML is cleared', async () => {
      // This test does the real work only for polyfill; for Chrome it does
      // nothing.
      const css2 = new CSSStyleSheet();
      await css2.replace('.test { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      const {children} = element.shadowRoot!;

      for (let i = children.length - 1; i >= 0; i--) {
        children[i].parentNode!.removeChild(children[i]);
      }

      await waitForMutationObserver();

      checkShadowCss(element, {...defaultChecker, height: '82px'});
    });

    it('applies to elements created during polyfill loading', () => {
      const host = document.querySelector('#added-while-loading')!;
      const span = host.shadowRoot!.querySelector('span')!;
      expect(getComputedStyle(span).color).toBe('rgb(0, 0, 255)');
    });

    it('loads sheets of custom elements in the shadow root', async () => {
      const [tag1] = createCustomElement([css]);
      const [tag2] = createCustomElement(undefined, {
        html: `<div><div><${tag1}></${tag1}></div></div>`,
      });
      const element2 = await fixture(`<${tag2}></${tag2}>`);
      const element1 = shadowRootRegistry.get(element2)!.querySelector(tag1)!;

      checkShadowCss(element1, defaultChecker);
    });

    describe('detached elements', () => {
      const detachedFixture = async (
        rootTag: string,
        ...nestedTags: readonly string[]
      ) => {
        const detachedElement = nestedTags.reduceRight<Element | null>(
          (acc, tag) => {
            const element = document.createElement(tag);

            if (acc) {
              element.appendChild(acc);
            }

            return element;
          },
          null,
        );

        const rootElement = await fixture(`<${rootTag}></${rootTag}>`);

        if (detachedElement) {
          rootElement.shadowRoot!.appendChild(detachedElement);
        }

        return rootElement;
      };

      it('applies styling to deeply nested web components', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        checkShadowCss(element, defaultChecker);

        const nested = element.shadowRoot!.querySelector(tag1)!;
        checkShadowCss(nested, defaultChecker);
      });

      it('applies styling to deeply nested web components even if host component does not have adoptedStyleSheets set', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement();

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        await waitForMutationObserver();

        const nested = element.shadowRoot!.querySelector(tag1)!;
        checkShadowCss(nested, defaultChecker);
      });
    });

    describe('Polyfill only', () => {
      beforeEach(() => {
        // If it is not a polyfill, ignore tests
        if (new CSSStyleSheet().constructor === CSSStyleSheet) {
          pending();
        }
      });

      it('does not re-create style element on removing the sibling node', async () => {
        const [tag] = createCustomElement([css], {
          html: `<div></div><div id='foo'></div><div></div>`,
        });
        const element = await fixture(`<${tag}></${tag}>`);

        const style = element.shadowRoot!.querySelector('style');

        const foo = element.shadowRoot!.getElementById('foo')!;
        foo.parentNode!.removeChild(foo);

        expect(element.shadowRoot!.querySelectorAll('style').length).toBe(1);
        expect(element.shadowRoot!.querySelector('style')).toBe(style);
      });

      it('re-creates styles on adoptedStyleSheets assigning', async () => {
        const css2 = new CSSStyleSheet();
        await css2.replace('.test { height: 82px; }');

        const [tag] = createCustomElement([css, css2]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(element.shadowRoot!.querySelectorAll('style').length).toBe(2);

        element.shadowRoot!.adoptedStyleSheets = [css2, css];

        expect(element.shadowRoot!.querySelectorAll('style').length).toBe(2);
      });
    });

    describe('adoptedStyleSheet property', () => {
      it('allows to re-assign the list of styles', async () => {
        const css2 = new CSSStyleSheet();
        await css2.replace('.test { height: 82px; }');

        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        element.shadowRoot!.adoptedStyleSheets = [css2];

        checkShadowCss(element, {height: '82px'}, {width: '53px'});
      });

      it('forbids assigning a non-Array value to adoptedStyleSheets', async () => {
        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(() => {
          // @ts-expect-error: an error should be thrown here at runtime
          element.shadowRoot!.adoptedStyleSheets = {};
        }).toThrow();
      });

      it('allows only CSSStyleSheet instances to be added to adoptedStyleSheets', async () => {
        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(() => {
          // @ts-expect-error: an error should be thrown here at runtime
          element.shadowRoot!.adoptedStyleSheets = [{}, css];
        }).toThrow();
      });
    });

    describe('CSSStyleSheet methods', () => {
      it('updates all the elements styles if CSSStyleSheet method is called', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(
          `<div><${tag}></${tag}><${tag2}></${tag2}></div>`,
        );
        const element1 = wrapper.querySelector(tag)!;
        const element2 = wrapper.querySelector(tag2)!;

        css.insertRule('.test { line-height: 41px }');

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('applies performed updates to all new elements', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(`<div id='wrapper'></div>`);

        css.insertRule('.test { line-height: 41px }');

        const element1 = document.createElement(tag);
        const element2 = document.createElement(tag2);
        const fragment = document.createDocumentFragment();
        fragment.appendChild(element1);
        fragment.appendChild(element2);

        wrapper.appendChild(fragment);

        await waitForMutationObserver();

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('updates styles of all elements if replace on CSSStyleSheet is called', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(
          `<div><${tag}></${tag}><${tag2}></${tag2}></div>`,
        );
        const element1 = wrapper.querySelector(tag)!;
        const element2 = wrapper.querySelector(tag2)!;

        css.replaceSync('.test { width: 25px; height: 9px; }');

        const checker = {width: '25px', height: '9px'};
        checkShadowCss(element1, checker);
        checkShadowCss(element2, checker);
      });

      it('works well with disconnected elements', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(
          `<div><${tag}></${tag}><${tag2}></${tag2}></div>`,
        );
        const element1 = wrapper.querySelector(tag)!;
        const element2 = wrapper.querySelector(tag2)!;

        const fragment = document.createDocumentFragment();

        fragment.appendChild(element1);
        fragment.appendChild(element2);

        css.insertRule('.test { line-height: 41px }');

        wrapper.appendChild(fragment);

        await waitForMutationObserver();

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });
    });

    describe('closed mode', () => {
      it('works correctly with the closed shadow root', async () => {
        const [tag] = createCustomElement([css], {mode: 'closed'});
        const element = await fixture(`<${tag}></${tag}>`);
        checkShadowCss(element, defaultChecker);
      });

      it('updates the styles in the closed shadow root', async () => {
        const [tag] = createCustomElement([css], {mode: 'closed'});
        const element = await fixture(`<${tag}></${tag}>`);
        css.replaceSync('.test { width: 20px; height: 91px; }');
        checkShadowCss(element, {width: '20px', height: '91px'});
      });

      it('loads sheets of custom elements in the closed shadow root', async () => {
        const [tag1] = createCustomElement([css], {});
        const [tag2] = createCustomElement([css], {mode: 'closed'});
        const [tag3] = createCustomElement(undefined, {
          mode: 'closed',
          html: `<div><div><${tag1}></${tag1}></div><div><${tag2}></${tag2}></div></div>`,
        });
        const element3 = await fixture(`<${tag3}></${tag3}>`);

        const shadowRoot3 = shadowRootRegistry.get(element3)!;
        const element1 = shadowRoot3.querySelector(tag1)!;
        const element2 = shadowRoot3.querySelector(tag2)!;

        checkShadowCss(element1, defaultChecker);
        checkShadowCss(element2, defaultChecker);
      });
    });
  });

  describe('Document', () => {
    let css: CSSStyleSheet;
    let defaultChecker: ShadowCSSChecker;

    const checkGlobalCss = (element, checker) => {
      const computed = getComputedStyle(element, null);

      for (const property in checker) {
        expect(computed.getPropertyValue(property)).toBe(checker[property]);
      }
    };

    beforeEach(() => {
      css = new CSSStyleSheet();
      css.replaceSync('.foo { width: 20px; height: 82px; }');
      defaultChecker = {width: '20px', height: '82px'};
    });

    it('allows adding new styles', async () => {
      document.adoptedStyleSheets = [css];

      const element = await fixture('<div class="foo"></div>');

      checkGlobalCss(element, defaultChecker);
    });

    it('allows adding new styles that affect existing ones', async () => {
      document.adoptedStyleSheets = [css];

      const element = await fixture('<div class="foo"></div>');

      const css2 = new CSSStyleSheet();
      css2.replaceSync('.foo { line-height: 9px }');

      document.adoptedStyleSheets = [css, css2];

      checkGlobalCss(element, {...defaultChecker, 'line-height': '9px'});
    });

    it('preserves styles if body is cleared', async () => {
      const bodyHtml = document.body.innerHTML;

      document.adoptedStyleSheets = [css];

      const element = await fixture('<div class="foo"></div>');

      const awaiter = waitForMutationObserver(document.body);

      document.body.innerHTML = '';
      document.body.appendChild(element);

      await awaiter; // Mutation Observer is asynchronous

      checkGlobalCss(element, defaultChecker);

      document.body.innerHTML = bodyHtml;
    });

    it('provides proper rule overriding if body is cleared', async () => {
      const bodyHtml = document.body.innerHTML;

      const css2 = new CSSStyleSheet();
      css2.replaceSync('.foo { line-height: 9px }');

      document.adoptedStyleSheets = [css, css2];

      const element = await fixture('<div class="foo"></div>');

      const awaiter = waitForMutationObserver(document.body);

      document.body.innerHTML = '';
      document.body.appendChild(element);

      await awaiter;

      checkGlobalCss(element, {...defaultChecker, 'line-height': '9px'});

      document.body.innerHTML = bodyHtml;
    });

    it('returns the styles properly', () => {
      const styleSheets = [css];
      document.adoptedStyleSheets = styleSheets;

      expect(document.adoptedStyleSheets).toEqual(styleSheets);
    });

    it('removes styles properly', async () => {
      const element = await fixture('<div class="foo"></div>');

      const css1 = new CSSStyleSheet();
      css1.replaceSync('.foo { line-height: 9px }');

      const css2 = new CSSStyleSheet();
      css2.replaceSync('.foo { line-height: 10px !important }');

      document.adoptedStyleSheets = [css1, css2];
      checkGlobalCss(element, {'line-height': '10px'});

      document.adoptedStyleSheets = [css1];
      checkGlobalCss(element, {'line-height': '9px'});
    });
  });
});
