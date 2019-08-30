# Constructible style sheets polyfill

[![Travis][build-badge]][build]
[![construct-style-sheets][npm-badge]][npm]
[![codecov](https://codecov.io/gh/calebdwilliams/construct-style-sheets/branch/master/graph/badge.svg)](https://codecov.io/gh/TechnionYP5777/project-name)

This package is a polyfill for the [constructible style sheets/adopted style sheets specification](https://github.com/WICG/construct-stylesheets/blob/gh-pages/explainer.md). The full specificaiton is enabled by default in Google Chrome as of version 73.

Currently [Mozilla is considering implementation of the feature](https://github.com/mozilla/standards-positions/issues/103), marking it as "worth prototyping" while Apple has not publically signaled, they have been active in the standards discussions surrounding it.

## Use case

The constructible style sheets proposal is intended to allow for the dynamic creation and sharing of style sheets, even across shadow boundaries. By adopting a style sheet into a shadow root, the same sheet can be applied to multiple nodes, including the document. 

## How it works

This polyfill will create a new style element for every `DocumentOrShadowRoot` into which the sheet is adopted. This is counter to the current proposal, but updates to the style sheet using the `replace` or `replaceSync` methods should update the relevant style elements with the updated content across all adopters.

No changes will occur in a browser that supports the feature by default.

## Installation

The package can be installed either by copying the [polyfill file](./adoptedStyleSheets.js) or by [installing using npm](https://docs.npmjs.com/getting-started/).

## Usage

```javascript
const everythingTomato = new CSSStyleSheet();
everythingTomato.replace(`
* {
    color: tomato;
}
`).then(console.log); // will log the CSSStyleSheet object

document.adoptedStyleSheets = [everythingTomato];

class TestEl extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.adoptedStyleSheets = [everythingTomato];
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `<h1>This will be tomato colored, too</h1>`;
    }
}

customElements('test-el', TestEl);

const testEl = new TestEl;
document.body.appendChild(testEl);
```

The polyfill will append new `style` tags to the designated `DocumentOrShadowRoot`. Manually removing the style node will cause a re-insertion of the styles at the designated root. To remove a style sheet, you _must_ remove the style element from the `element.adoptedStyleSheets` array. The behavior here is supposed to emulate a `FrozenArray`, so modifying the array in question will have no effect until the value is changed using a setter.