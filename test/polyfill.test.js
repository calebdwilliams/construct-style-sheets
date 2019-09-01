import './polyfills';

import {fixtureCleanup} from '@open-wc/testing-helpers/src/fixtureWrapper';
import {defineCE} from '@open-wc/testing-helpers/src/helpers';
import {stringFixture as fixture} from '@open-wc/testing-helpers/src/stringFixture';
import '../adoptedStyleSheets.js';

var isPolyfill = new CSSStyleSheet().constructor !== CSSStyleSheet;
var hasShadyCSS = 'ShadyCSS' in window;

function ignore() {
  if (!isPolyfill || hasShadyCSS) {
    pending();
  }
}

describe('Constructible Style Sheets polyfill', function() {
  var sheet;

  beforeEach(function() {
    sheet = new CSSStyleSheet();
  });

  describe('CSSStyleSheet object', function() {
    var globalStyle;

    beforeEach(function() {
      globalStyle = document.createElement('style');
      globalStyle.innerHTML = '.only-test { color: red; }';
      document.body.appendChild(globalStyle);
    });

    afterEach(function() {
      globalStyle.parentNode.removeChild(globalStyle);
    });

    it('has replace and replaceSync methods', function() {
      expect(sheet.cssRules).toBeDefined();
      expect(sheet.replace).toBeDefined();
      expect(sheet.replaceSync).toBeDefined();
    });

    it('passes instanceof check', function() {
      expect(sheet instanceof CSSStyleSheet).toBeTruthy();
    });

    describe('replace', function() {
      var result;

      beforeEach(function() {
        result = sheet.replace('* { color: tomato; }');
      });

      it('returns a promise that resolves to a sheet', function() {
        expect(result instanceof Promise).toBe(true);

        return result.then(function(resolved) {
          // Equal because polyfill cannot return the same CSSStyleSheet object
          // since it is immutable.
          expect(resolved).toEqual(sheet);
        });
      });

      it('has a rule set', function() {
        return result.then(function(updatedSheet) {
          expect(updatedSheet.cssRules.length > 0).toBeTruthy();
        });
      });

      it('throws an error if it is called not from a CSSStyleSheet', function() {
        return globalStyle.sheet
          .replace('.only-test { color: blue; }')
          .catch(function(error) {
            expect(error.message).toBe(
              "Failed to execute 'replace' on 'CSSStyleSheet': Can't call replace on non-constructed CSSStyleSheets."
            );
          });
      });
    });

    describe('replaceSync', function() {
      var result;

      beforeEach(function() {
        // Since the polyfill's replaceSync returns a new sheet and the native
        // implementation does not, it is a little hack to get tests passed.
        //
        // Do not use this hack in the production code.
        result = sheet.replaceSync('* { color: tomato; }') || sheet;
      });

      it('returns a CSSStyleSheet object itself', function() {
        // Equal because polyfill cannot return the same CSSStyleSheet object
        // since it is immutable.
        expect(result).toEqual(sheet);
      });

      it('has a rule set', function() {
        expect(result.cssRules.length > 0).toBeTruthy();
      });

      it('throws an error if the @import expression exist in the CSS code', function() {
        try {
          sheet.replaceSync('@import "test.css"');
        } catch (error) {
          expect(error.message).toContain(
            '@import rules are not allowed when creating stylesheet synchronously'
          );
        }
      });

      it('throws an error if it is called not from a CSSStyleSheet', function() {
        try {
          globalStyle.sheet.replaceSync('.only-test { color: blue; }');
        } catch (error) {
          expect(error.message).toBe(
            "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets."
          );
        }
      });
    });
  });

  describe('Common behavior', function() {
    var css;
    var defaultChecker;

    function createCustomElement(sheets, html) {
      html = html || '';

      var template = document.createElement('template');
      template.innerHTML = html + '<div class="test"></div>';

      function CustomElement() {
        var self = Reflect.construct(HTMLElement, [], CustomElement);

        var root = self.attachShadow({mode: 'open'});

        if (sheets) {
          root.adoptedStyleSheets = sheets;
        }

        if ('ShadyCSS' in window) {
          ShadyCSS.prepareTemplateStyles(template, self.localName);
        }

        root.appendChild(template.content.cloneNode(true));

        if ('ShadyCSS' in window) {
          ShadyCSS.styleElement(self);
        }

        return self;
      }

      Object.setPrototypeOf(CustomElement.prototype, HTMLElement.prototype);
      Object.setPrototypeOf(CustomElement, HTMLElement);

      return defineCE(CustomElement);
    }

    function checkShadowCss(element, positiveChecker, negativeChecker) {
      var test = document.createElement('div');
      test.classList.add('test');
      element.shadowRoot.appendChild(test);

      var computed = getComputedStyle(test, null);

      for (var property in positiveChecker) {
        expect(computed.getPropertyValue(property)).toBe(
          positiveChecker[property]
        );
      }

      for (var property in negativeChecker) {
        expect(computed.getPropertyValue(property)).not.toBe(
          negativeChecker[property]
        );
      }
    }

    beforeEach(function() {
      css = new CSSStyleSheet();
      css.replaceSync('.test { width: 53px; height: 91px; }');
      defaultChecker = {width: '53px', height: '91px'};
    });

    it('applies styling to web component', function() {
      var tag = createCustomElement([css]);

      return fixture('<' + tag + '></' + tag + '>').then(function(element) {
        checkShadowCss(element, defaultChecker);
      });
    });

    it('can accept more than 1 style sheet', function() {
      var css2 = new CSSStyleSheet();
      css2.replace('.test { line-height: 35px; }');

      var tag = createCustomElement([css, css2]);

      return fixture('<' + tag + '></' + tag + '>').then(function(element) {
        checkShadowCss(
          element,
          Object.assign({}, defaultChecker, {'line-height': '35px'})
        );
      });
    });

    it('handles rules overriding properly', function() {
      var css2 = new CSSStyleSheet();
      css2.replace('.test { height: 82px; }');

      var tag = createCustomElement([css, css2]);

      return fixture('<' + tag + '></' + tag + '>').then(function(element) {
        checkShadowCss(
          element,
          Object.assign({}, defaultChecker, {height: '82px'})
        );
      });
    });

    it('restores styles if innerHTML is cleared', function() {
      var tag = createCustomElement([css]);

      return fixture('<' + tag + '></' + tag + '>')
        .then(function(element) {
          element.shadowRoot.innerHTML = '';
          return element; // MutationObserver is asynchronous
        })
        .then(function(element) {
          checkShadowCss(element, defaultChecker);
        });
    });

    it('provides proper rule overriding if innerHTML is cleared', function() {
      // This test does the real work only for polyfill; for Chrome it does
      // nothing.

      var css2 = new CSSStyleSheet();
      css2.replace('.test { height: 82px; }');

      var tag = createCustomElement([css, css2]);

      return fixture('<' + tag + '></' + tag + '>')
        .then(function(element) {
          var children = element.shadowRoot.children;

          for (var i = children.length - 1; i >= 0; i--) {
            children[i].parentNode.removeChild(children[i]);
          }

          return element; // MutationObserver is asynchronous
        })
        .then(function(element) {
          checkShadowCss(
            element,
            Object.assign({}, defaultChecker, {height: '82px'})
          );
        });
    });

    describe('detached elements', function() {
      function detachedFixture(rootTag) {
        var detachedElement;

        for (var i = arguments.length - 1; i > 0; i--) {
          var element = document.createElement(arguments[i]);

          if (detachedElement) {
            element.appendChild(detachedElement);
          }

          detachedElement = element;
        }

        return fixture('<' + rootTag + '></' + rootTag + '>').then(function(
          rootElement
        ) {
          rootElement.shadowRoot.appendChild(detachedElement);
          return rootElement;
        });
      }

      it('applies styling to deeply nested web components', function() {
        var tag1 = createCustomElement([css]);
        var tag2 = createCustomElement([css]);

        return detachedFixture(tag2, 'div', 'div', 'div', tag1)
          .then(function(element) {
            checkShadowCss(element, defaultChecker);

            return element; // MutationObserver is asynchronous
          })
          .then(function(element) {
            var nested = element.shadowRoot.querySelector(tag1);
            checkShadowCss(nested, defaultChecker);
          });
      });

      it('applies styling to deeply nested web components even if host component does not have adoptedStyleSheets set', function() {
        var tag1 = createCustomElement([css]);
        var tag2 = createCustomElement();

        return detachedFixture(tag2, 'div', 'div', 'div', tag1)
          .then(function(element) {
            return element; // MutationObserver is asynchronous
          })
          .then(function(element) {
            var nested = element.shadowRoot.querySelector(tag1);
            checkShadowCss(nested, defaultChecker);
          });
      });
    });

    describe('Polyfill only', function() {
      it('does not re-create style element on removing the sibling node', function() {
        ignore();

        var tag = createCustomElement(
          [css],
          '<div></div><div id="foo"></div><div></div>'
        );

        return fixture('<' + tag + '></' + tag + '>').then(function(element) {
          var style = element.shadowRoot.querySelector('style');

          var foo = element.shadowRoot.getElementById('foo');
          foo.parentNode.removeChild(foo);

          expect(element.shadowRoot.querySelectorAll('style').length).toBe(1);
          expect(element.shadowRoot.querySelector('style')).toBe(style);
        });
      });

      it('re-creates styles on adoptedStyleSheets assigning', function() {
        ignore();

        var css2 = new CSSStyleSheet();
        css2.replace('.test { height: 82px; }');

        var tag = createCustomElement([css, css2]);

        return fixture('<' + tag + '></' + tag + '>').then(function(element) {
          expect(element.shadowRoot.querySelectorAll('style').length).toBe(2);

          element.shadowRoot.adoptedStyleSheets = [css2, css];

          expect(element.shadowRoot.querySelectorAll('style').length).toBe(2);
        });
      });
    });

    describe('adoptedStyleSheet property', function() {
      it('allows to re-assign the list of styles', function() {
        var css2 = new CSSStyleSheet();
        css2.replace('.test { height: 82px; }');

        var tag = createCustomElement([css]);

        return fixture('<' + tag + '></' + tag + '>').then(function(element) {
          element.shadowRoot.adoptedStyleSheets = [css2];
          checkShadowCss(element, {height: '82px'}, {width: '53px'});
        });
      });

      it('forbids assigning a non-Array value to adoptedStyleSheets', function() {
        var tag = createCustomElement([css]);

        return fixture('<' + tag + '></' + tag + '>').then(function(element) {
          expect(function() {
            element.shadowRoot.adoptedStyleSheets = {};
          }).toThrow();
        });
      });

      it('allows only CSSStyleSheet instances to be added to adoptedStyleSheets', function() {
        var tag = createCustomElement([css]);

        return fixture('<' + tag + '></' + tag + '>').then(function(element) {
          expect(function() {
            element.shadowRoot.adoptedStyleSheets = [{}, css];
          }).toThrow();
        });
      });
    });

    describe('CSSStyleSheet methods', function() {
      it('updates all the elements styles if CSSStyleSheet method is called', function() {
        var tag = createCustomElement([css]);
        var tag2 = createCustomElement([css]);

        return fixture(
          '<div><' + tag + '></' + tag + '><' + tag2 + '></' + tag2 + '></div>'
        ).then(function(wrapper) {
          var element1 = wrapper.querySelector(tag);
          var element2 = wrapper.querySelector(tag2);

          css.insertRule('.test { line-height: 41px }');

          checkShadowCss(
            element1,
            Object.assign({}, defaultChecker, {'line-height': '41px'})
          );
          checkShadowCss(
            element2,
            Object.assign({}, defaultChecker, {'line-height': '41px'})
          );
        });
      });

      it('applies performed updates to all new elements', function() {
        var tag = createCustomElement([css]);
        var tag2 = createCustomElement([css]);

        return fixture('<div id="wrapper"></div>')
          .then(function(wrapper) {
            css.insertRule('.test { line-height: 41px }');

            var element1 = document.createElement(tag);
            var element2 = document.createElement(tag2);

            var fragment = document.createDocumentFragment();
            fragment.appendChild(element1);
            fragment.appendChild(element2);

            wrapper.appendChild(fragment);

            return [element1, element2]; // MutationObserver is asynchronous
          })
          .then(function(elements) {
            checkShadowCss(
              elements[0],
              Object.assign({}, defaultChecker, {'line-height': '41px'})
            );
            checkShadowCss(
              elements[1],
              Object.assign({}, defaultChecker, {'line-height': '41px'})
            );
          });
      });

      it('updates styles of all elements if replace on CSSStyleSheet is called', function() {
        var tag = createCustomElement([css]);
        var tag2 = createCustomElement([css]);

        return fixture(
          '<div><' + tag + '></' + tag + '><' + tag2 + '></' + tag2 + '></div>'
        ).then(function(wrapper) {
          var element1 = wrapper.querySelector(tag);
          var element2 = wrapper.querySelector(tag2);

          css.replaceSync('.test { width: 25px; height: 9px; }');

          var checker = {width: '25px', height: '9px'};
          checkShadowCss(element1, checker);
          checkShadowCss(element2, checker);
        });
      });

      it('works well with disconnected elements', function() {
        var tag = createCustomElement([css]);
        var tag2 = createCustomElement([css]);

        return fixture(
          '<div><' + tag + '></' + tag + '><' + tag2 + '></' + tag2 + '></div>'
        )
          .then(function(wrapper) {
            var element1 = wrapper.querySelector(tag);
            var element2 = wrapper.querySelector(tag2);

            var fragment = document.createDocumentFragment();

            fragment.appendChild(element1);
            fragment.appendChild(element2);

            css.insertRule('.test { line-height: 41px }');

            wrapper.appendChild(fragment);

            return [element1, element2]; // MutationObserver is asynchronous
          })
          .then(function(elements) {
            checkShadowCss(
              elements[0],
              Object.assign({}, defaultChecker, {'line-height': '41px'})
            );
            checkShadowCss(
              elements[1],
              Object.assign({}, defaultChecker, {'line-height': '41px'})
            );
          });
      });
    });

    describe('Document', function() {
      var css;
      var defaultChecker;

      function checkGlobalCss(element, checker) {
        var computed = getComputedStyle(element, null);

        for (var property in checker) {
          expect(computed.getPropertyValue(property)).toBe(checker[property]);
        }
      }

      beforeEach(function() {
        css = new CSSStyleSheet();
        css.replaceSync('.foo { width: 20px; height: 82px; }');
        defaultChecker = {width: '20px', height: '82px'};
      });

      it('allows adding new styles', function() {
        document.adoptedStyleSheets = [css];

        fixture('<div class="foo"></div>').then(function(element) {
          checkGlobalCss(element, defaultChecker);
        });
      });

      it('allows adding new styles that affect existing ones', function() {
        document.adoptedStyleSheets = [css];

        fixture('<div class="foo"></div>').then(function(element) {
          var css2 = new CSSStyleSheet();
          css2.replaceSync('.foo { line-height: 9px; }');

          document.adoptedStyleSheets = [css, css2];

          checkGlobalCss(
            element,
            Object.assign({}, defaultChecker, {'line-height': '9px'})
          );
        });
      });

      it('preserves styles if body is cleared', function() {
        var bodyHtml = document.body.innerHTML;

        document.adoptedStyleSheets = [css];

        fixture('<div class="foo"></div>')
          .then(function(element) {
            document.body.innerHTML = '';
            document.body.appendChild(element);

            return element; // Mutation Observer is asynchronous
          })
          .then(function(element) {
            checkGlobalCss(element, defaultChecker);
            document.body.innerHTML = bodyHtml;
          });
      });

      it('provides proper rule overriding if body is cleared', function() {
        var bodyHtml = document.body.innerHTML;

        var css2 = new CSSStyleSheet();
        css2.replaceSync('.foo { line-height: 9px; }');

        document.adoptedStyleSheets = [css, css2];

        return fixture('<div class="foo"></div>')
          .then(function(element) {
            document.body.innerHTML = '';
            document.body.appendChild(element);

            return element; // Mutation Observer is asynchronous
          })
          .then(function(element) {
            checkGlobalCss(
              element,
              Object.assign({}, defaultChecker, {'line-height': '9px'})
            );
            // document.body.innerHTML = bodyHtml;
          });
      });

      it('returns the styles properly', function() {
        var styleSheets = [css];
        document.adoptedStyleSheets = styleSheets;

        expect(document.adoptedStyleSheets).toEqual(styleSheets);
      });
    });
  });
});
