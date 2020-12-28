import {defineCE} from '@open-wc/testing-helpers/src/helpers';
import {stringFixture as fixture} from '@open-wc/testing-helpers/src/stringFixture';

// This is so that tests will run synchronously despite
// the fact that requestAnimationFrame is asynchronous
window.requestAnimationFrame = function(callback) {
  callback();
}

const IMPORT_PATTERNS = [
  '@import \'foo.css\'',
  '@import "foo.css"',
  '@import url(\'foo.css\')',
  '@import url("foo.css")',
]

describe('Constructible Style Sheets polyfill', () => {
  describe('CSSStyleSheet object', () => {
    let globalStyle;
    let sheet;

    beforeEach(() => {
      sheet = new CSSStyleSheet();
    });

    beforeEach(() => {
      globalStyle = document.createElement('style');
      globalStyle.innerHTML = '.only-test { color: red; }';
      document.body.appendChild(globalStyle);
    });

    afterEach(() => {
      globalStyle.parentNode.removeChild(globalStyle);
    });

    it('has replace and replaceSync methods', () => {
      expect(sheet.cssRules).toBeDefined();
      expect(sheet.replace).toBeDefined();
      expect(sheet.replaceSync).toBeDefined();
    });

    it('passes instanceof checks', () => {
      expect(sheet instanceof CSSStyleSheet).toBeTruthy();

      const style = document.createElement('style');
      document.body.append(style);
      expect(style.sheet instanceof CSSStyleSheet).toBeTruthy();
    });

    describe('illegal invocation', () => {
      const REG_ILLEGAL = /Illegal invocation/i;

      // sync methods
      ['deleteRule', 'insertRule', 'replaceSync'].forEach(method => {
        it(`occurs when ${method} is improperly invoked`, () => {
          expect(CSSStyleSheet.prototype[method]).toThrowError(REG_ILLEGAL)
        })
      });

      // async methods
      ['replace'].forEach(method => {
        it(`occurs when ${method} is improperly invoked`, async () => {
          try {
            await CSSStyleSheet.prototype[method]();
          } catch (error) {
            expect(error.message).toMatch(REG_ILLEGAL);
          }
        })
      });

      // properties/getters
      ['cssRules'].forEach(prop => {
        it(`occurs when ${prop} is improperly invoked`, () => {
          expect(() => CSSStyleSheet.prototype[prop]).toThrowError(REG_ILLEGAL)
        })
      });
    });

    describe('replace', () => {
      let result;

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
        await globalStyle.sheet
          .replace('.only-test { color: blue; }')
          .then(() => expect(true).toBe(false)) // should not hit this
          .catch(error => {
            expect(error.message).toContain(
              "Can't call replace on non-constructed CSSStyleSheets.",
            );
          });
      });

      it('removes @import statements', async () => {
        return await Promise.all(
          IMPORT_PATTERNS.map(pattern => 
            sheet.replace(pattern).then(() => {
              expect(sheet.cssRules.length).toBe(0)
            })
          )
        )
      });
    });

    describe('replaceSync', () => {
      let result;

      beforeEach(() => {
        // Since the polyfill's replaceSync returns a new sheet and the native
        // implementation does not, it is a little hack to get tests passed.
        //
        // Do not use this hack in the production code.
        result = sheet.replaceSync('* { color: tomato; }') || sheet;
      });

      it('returns a CSSStyleSheet object itself', () => {
        // Use toBe because there should be referential integrity
        expect(result).toBe(sheet);
      });

      it('has a rule set', async () => {
        expect(result.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if it is called not from a CSSStyleSheet', () => {
        try {
          globalStyle.sheet.replaceSync('.only-test { color: blue; }');
          expect(true).toBe(false) // should not hit this
        } catch (error) {
          expect(error.message).toContain(
            "Can't call replaceSync on non-constructed CSSStyleSheets.",
          );
        }
      });

      it('removes @import statements', () => {
        IMPORT_PATTERNS.forEach(pattern => {
          sheet.replaceSync(pattern)
          expect(sheet.cssRules.length).toBe(0)
        })
      });
    });
  });

  describe('Web Components', () => {
    beforeEach(() => {
      // We don't support web components in Edge or IE
      if (!('ShadowRoot' in window)) {
        pending();
      }
    });

    const createCustomElement = (sheets, html = '') => {
      class CustomElement extends HTMLElement {
        constructor() {
          super();
          const root = this.attachShadow({mode: 'open'});

          if (sheets) {
            root.adoptedStyleSheets = sheets;
          }

          root.innerHTML = html;
        }
      }

      return [defineCE(CustomElement), CustomElement];
    };

    const checkShadowCss = (element, positiveChecker, negativeChecker) => {
      const test = document.createElement('div');
      test.classList.add('test');
      element.shadowRoot.appendChild(test);

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

    let css;
    let defaultChecker;

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
      css2.replace('.test { line-height: 35px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkShadowCss(element, {...defaultChecker, 'line-height': '35px'});
    });

    it('handles rules overriding properly', async () => {
      const css2 = new CSSStyleSheet();
      css2.replace('.test { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkShadowCss(element, {...defaultChecker, height: '82px'});
    });

    it('restores styles if innerHTML is cleared', async () => {
      const [tag] = createCustomElement([css]);
      const element = await fixture(`<${tag}></${tag}>`);
      element.shadowRoot.innerHTML = '';

      await null; // MutationObserver is asynchronous

      checkShadowCss(element, defaultChecker);
    });

    it('provides proper rule overriding if innerHTML is cleared', async () => {
      // This test does the real work only for polyfill; for Chrome it does
      // nothing.

      const css2 = new CSSStyleSheet();
      css2.replace('.test { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      const {children} = element.shadowRoot;

      for (let i = children.length - 1; i >= 0; i--) {
        children[i].parentNode.removeChild(children[i]);
      }

      await null; // MutationObserver is asynchronous

      checkShadowCss(element, {...defaultChecker, height: '82px'});
    });

    describe('detached elements', () => {
      const detachedFixture = async (rootTag, ...nestedTags) => {
        const detachedElement = nestedTags.reduceRight((acc, tag) => {
          const element = document.createElement(tag);

          if (acc) {
            element.appendChild(acc);
          }

          return element;
        }, null);

        const rootElement = await fixture(`<${rootTag}></${rootTag}>`);
        rootElement.shadowRoot.appendChild(detachedElement);

        return rootElement;
      };

      it('applies styling to deeply nested web components', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        checkShadowCss(element, defaultChecker);
        // await null; // MutationObserver is asynchronous

        const nested = element.shadowRoot.querySelector(tag1);
        checkShadowCss(nested, defaultChecker);
      });

      it('applies styling to deeply nested web components even if host component does not have adoptedStyleSheets set', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement();

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        await null; // MutationObserver is asynchronous

        const nested = element.shadowRoot.querySelector(tag1);
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
        const [tag] = createCustomElement(
          [css],
          `<div></div><div id="foo"></div><div></div>`,
        );
        const element = await fixture(`<${tag}></${tag}>`);

        const style = element.shadowRoot.querySelector('style');

        const foo = element.shadowRoot.getElementById('foo');
        foo.parentNode.removeChild(foo);

        expect(element.shadowRoot.querySelectorAll('style').length).toBe(1);
        expect(element.shadowRoot.querySelector('style')).toBe(style);
      });

      it('re-creates styles on adoptedStyleSheets assigning', async () => {
        const css2 = new CSSStyleSheet();
        css2.replace('.test { height: 82px; }');

        const [tag] = createCustomElement([css, css2]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(element.shadowRoot.querySelectorAll('style').length).toBe(2);

        element.shadowRoot.adoptedStyleSheets = [css2, css];

        expect(element.shadowRoot.querySelectorAll('style').length).toBe(2);
      });
    });

    describe('adoptedStyleSheet property', () => {
      it('allows to re-assign the list of styles', async () => {
        const css2 = new CSSStyleSheet();
        css2.replace('.test { height: 82px; }');

        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        element.shadowRoot.adoptedStyleSheets = [css2];

        checkShadowCss(element, {height: '82px'}, {width: '53px'});
      });

      it('forbids assigning a non-Array value to adoptedStyleSheets', async () => {
        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(() => {
          element.shadowRoot.adoptedStyleSheets = {};
        }).toThrow();
      });

      it('allows only CSSStyleSheet instances to be added to adoptedStyleSheets', async () => {
        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        expect(() => {
          element.shadowRoot.adoptedStyleSheets = [{}, css];
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
        const element1 = wrapper.querySelector(tag);
        const element2 = wrapper.querySelector(tag2);

        css.insertRule('.test { line-height: 41px }');

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('applies performed updates to all new elements', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(`<div id="wrapper"></div>`);

        css.insertRule('.test { line-height: 41px }');

        const element1 = document.createElement(tag);
        const element2 = document.createElement(tag2);
        const fragment = document.createDocumentFragment();
        fragment.appendChild(element1);
        fragment.appendChild(element2);

        wrapper.appendChild(fragment);

        await null; // MutationObserver is asynchronous

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('updates styles of all elements if replace on CSSStyleSheet is called', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(
          `<div><${tag}></${tag}><${tag2}></${tag2}></div>`,
        );
        const element1 = wrapper.querySelector(tag);
        const element2 = wrapper.querySelector(tag2);

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
        const element1 = wrapper.querySelector(tag);
        const element2 = wrapper.querySelector(tag2);

        const fragment = document.createDocumentFragment();

        fragment.appendChild(element1);
        fragment.appendChild(element2);

        css.insertRule('.test { line-height: 41px }');

        wrapper.appendChild(fragment);

        await null; // MutationObserver is asynchronous

        checkShadowCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkShadowCss(element2, {...defaultChecker, 'line-height': '41px'});
      });
    });
  });

  describe('Document', () => {
    let css;
    let defaultChecker;

    const checkGlobalCss = (element, checker) => {
      const computed = getComputedStyle(element, null);

      for (const property in checker) {
        expect(computed.getPropertyValue(property)).toBe(checker[property]);
      }
    };

    // Promise polyfill for IE does not work correctly, so we cannot just await
    // null like we did earlier
    const waitForMutationObserver = async (elementToObserve) => {
      return new Promise((resolve, reject) => {
        try {
          let observer;

          const cb = () => {
            observer.disconnect();
            resolve();
          };

          observer = new MutationObserver(cb);
          observer.observe(elementToObserve, {childList: true, subtree: true});
        } catch (e) {
          reject(e);
        }
      });
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
