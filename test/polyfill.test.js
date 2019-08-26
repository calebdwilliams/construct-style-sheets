import {defineCE} from '@open-wc/testing-helpers/src/helpers';
import {stringFixture as fixture} from '@open-wc/testing-helpers/src/stringFixture';
import '../adoptedStyleSheets.js';

const isPolyfill = new CSSStyleSheet().constructor !== CSSStyleSheet;

const ignore = () => {
  if (!isPolyfill) {
    pending();
  }
};

describe('Constructible Style Sheets polyfill', () => {
  let sheet;

  const checkCss = (element, checker) => {
    const computed = getComputedStyle(element, null);

    for (const property in checker) {
      expect(computed.getPropertyValue(property)).toBe(checker[property]);
    }
  };

  beforeEach(() => {
    sheet = new CSSStyleSheet();
  });

  describe('CSSStyleSheet object', () => {
    it('has replace and replaceSync methods', () => {
      expect(sheet.cssRules).toBeDefined();
      expect(sheet.replace).toBeDefined();
      expect(sheet.replaceSync).toBeDefined();
    });

    it('passes instanceof check', () => {
      expect(sheet instanceof CSSStyleSheet).toBeTruthy();
    });

    describe('replace', () => {
      let result;

      beforeEach(() => {
        result = sheet.replace('* { color: tomato; }');
      });

      it('returns a promise that resolves to a sheet', async () => {
        expect(result instanceof Promise).toBe(true);

        const resolved = await result;

        // Equal because polyfill cannot return the same CSSStyleSheet object
        // since it is immutable.
        expect(resolved).toEqual(sheet);
      });

      it('has a rule set', async () => {
        const updatedSheet = await result;
        expect(updatedSheet.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if it is called not from a CSSStyleSheet', async () => {
        await CSSStyleSheet.prototype.replace
          .call({}, '* { color: tomato; }')
          .catch(error => {
            expect(error instanceof TypeError).toBeTruthy();
            expect(error.message).toContain('Illegal invocation');
          });
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
        // Equal because polyfill cannot return the same CSSStyleSheet object
        // since it is immutable.
        expect(result).toEqual(sheet);
      });

      it('has a rule set', async () => {
        expect(result.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if the @import expression exist in the CSS code', () => {
        try {
          sheet.replaceSync('@import "test.css"');
        } catch (error) {
          expect(error instanceof DOMException).toBeTruthy();
          expect(error.message).toContain(
            '@import rules are not allowed when creating stylesheet synchronously',
          );
        }
      });

      it('throws an error if it is called not from a CSSStyleSheet', () => {
        try {
          CSSStyleSheet.prototype.replaceSync.call({}, '* { color: tomato; }');
        } catch (error) {
          expect(error instanceof TypeError).toBeTruthy();
          expect(error.message).toContain('Illegal invocation');
        }
      });
    });
  });

  describe('Common behavior', () => {
    let css;
    let defaultChecker;

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

      const tag = defineCE(CustomElement);

      return [tag, CustomElement];
    };

    beforeEach(() => {
      css = new CSSStyleSheet();
      css.replaceSync(':host { width: 53px; height: 91px; }');
      defaultChecker = {width: '53px', height: '91px'};
    });

    it('applies styling to web component', async () => {
      const [tag] = createCustomElement([css]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkCss(element, defaultChecker);
    });

    it('can accept more than 1 style sheet', async () => {
      const css2 = new CSSStyleSheet();
      css2.replace(':host { line-height: 35px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkCss(element, {...defaultChecker, 'line-height': '35px'});
    });

    it('handles rules overriding properly', async () => {
      const css2 = new CSSStyleSheet();
      css2.replace(':host { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      checkCss(element, {...defaultChecker, height: '82px'});
    });

    it('restores styles if innerHTML is cleared', async () => {
      const [tag] = createCustomElement([css]);
      const element = await fixture(`<${tag}></${tag}>`);
      element.shadowRoot.innerHTML = '';

      await null; // MutationObserver is asynchronous

      checkCss(element, defaultChecker);
    });

    it('provides proper rule overriding if innerHTML is cleared', async () => {
      // This test does the real work only for polyfill; for Chrome it does
      // nothing.

      const css2 = new CSSStyleSheet();
      css2.replace(':host { height: 82px; }');

      const [tag] = createCustomElement([css, css2]);
      const element = await fixture(`<${tag}></${tag}>`);
      const {children} = element.shadowRoot;

      for (let i = children.length - 1; i >= 0; i--) {
        children[i].remove();
      }

      await null; // MutationObserver is asynchronous

      checkCss(element, {...defaultChecker, height: '82px'});
    });

    describe('detached elements', () => {
      const detachedFixture = async (rootTag, ...nestedTags) => {
        const detachedElement = nestedTags.reduceRight((acc, tag) => {
          const element = document.createElement(tag);

          if (acc) {
            element.append(acc);
          }

          return element;
        }, null);

        const rootElement = await fixture(`<${rootTag}></${rootTag}>`);
        rootElement.shadowRoot.append(detachedElement);

        return rootElement;
      };

      it('applies styling to deeply nested web components', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        checkCss(element, defaultChecker);
        // await null; // MutationObserver is asynchronous

        const nested = element.shadowRoot.querySelector(tag1);
        checkCss(nested, defaultChecker);
      });

      it('applies styling to deeply nested web components even if host component does not have adoptedStyleSheets set', async () => {
        const [tag1] = createCustomElement([css]);
        const [tag2] = createCustomElement();

        const element = await detachedFixture(tag2, 'div', 'div', 'div', tag1);
        await null; // MutationObserver is asynchronous

        const nested = element.shadowRoot.querySelector(tag1);
        checkCss(nested, defaultChecker);
      });
    });

    describe('Polyfill only', () => {
      it('does not re-create style element on removing the sibling node', async () => {
        ignore();

        const [tag] = createCustomElement(
          [css],
          `<div></div><div id="foo"></div><div></div>`,
        );
        const element = await fixture(`<${tag}></${tag}>`);

        const style = element.shadowRoot.querySelector('style');

        const foo = element.shadowRoot.getElementById('foo');
        foo.remove();

        expect(element.shadowRoot.querySelectorAll('style').length).toBe(1);
        expect(element.shadowRoot.querySelector('style')).toBe(style);
      });

      it('re-creates styles on adoptedStyleSheets assigning', async () => {
        ignore();

        const css2 = new CSSStyleSheet();
        css2.replace(':host { height: 82px; }');

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
        css2.replace(':host { height: 82px; }');

        const [tag] = createCustomElement([css]);
        const element = await fixture(`<${tag}></${tag}>`);

        element.shadowRoot.adoptedStyleSheets = [css2];

        checkCss(element, {width: 'auto', height: '82px'});
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

        css.insertRule(':host { line-height: 41px }');

        checkCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('applies performed updates to all new elements', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(`<div id="wrapper"></div>`);

        css.insertRule(':host { line-height: 41px }');

        const element1 = document.createElement(tag);
        const element2 = document.createElement(tag2);
        wrapper.append(element1, element2);

        await null; // MutationObserver is asynchronous

        checkCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkCss(element2, {...defaultChecker, 'line-height': '41px'});
      });

      it('updates styles of all elements if replace on CSSStyleSheet is called', async () => {
        const [tag] = createCustomElement([css]);
        const [tag2] = createCustomElement([css]);
        const wrapper = await fixture(
          `<div><${tag}></${tag}><${tag2}></${tag2}></div>`,
        );
        const element1 = wrapper.querySelector(tag);
        const element2 = wrapper.querySelector(tag2);

        css.replaceSync(':host { width: 25px; height: 9px; }');

        const checker = {width: '25px', height: '9px'};
        checkCss(element1, checker);
        checkCss(element2, checker);
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

        fragment.append(element1, element2);

        css.insertRule(':host { line-height: 41px }');

        wrapper.append(element1, element2);

        await null; // MutationObserver is asynchronous

        checkCss(element1, {...defaultChecker, 'line-height': '41px'});
        checkCss(element2, {...defaultChecker, 'line-height': '41px'});
      });
    });

    describe('Document', () => {
      let css;
      let defaultChecker;

      beforeEach(() => {
        css = new CSSStyleSheet();
        css.replaceSync('.foo { width: 20px; height: 82px; }');
        defaultChecker = {width: '20px', height: '82px'};
      });

      it('allows adding new styles', async () => {
        document.adoptedStyleSheets = [css];

        const element = await fixture('<div class="foo"></div>');

        checkCss(element, defaultChecker);
      });

      it('allows adding new styles that affect existing ones', async () => {
        document.adoptedStyleSheets = [css];

        const element = await fixture('<div class="foo"></div>');

        const css2 = new CSSStyleSheet();
        css2.replaceSync('.foo { line-height: 9px }');

        document.adoptedStyleSheets = [css, css2];

        checkCss(element, {...defaultChecker, 'line-height': '9px'});
      });

      it('preserves styles if body is cleared', async () => {
        const bodyHtml = document.body.innerHTML;

        document.adoptedStyleSheets = [css];

        const element = await fixture('<div class="foo"></div>');

        document.body.innerHTML = '';
        document.body.append(element);

        await null; // Mutation Observer is asynchronous

        checkCss(element, defaultChecker);

        document.body.innerHTML = bodyHtml;
      });

      it('provides proper rule overriding if body is cleared', async () => {
        const bodyHtml = document.body.innerHTML;

        const css2 = new CSSStyleSheet();
        css2.replaceSync('.foo { line-height: 9px }');

        document.adoptedStyleSheets = [css, css2];

        const element = await fixture('<div class="foo"></div>');

        document.body.innerHTML = '';
        document.body.append(element);

        await null; // Mutation Observer is asynchronous

        checkCss(element, {...defaultChecker, 'line-height': '9px'});

        document.body.innerHTML = bodyHtml;
      });

      it('returns the styles properly', () => {
        const styleSheets = [css];
        document.adoptedStyleSheets = styleSheets;

        expect(document.adoptedStyleSheets).toEqual(styleSheets);
      });
    });
  });
});
