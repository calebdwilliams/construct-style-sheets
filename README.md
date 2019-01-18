# Constructible style sheets polyfill

This package is a polyfill for the [constructible style sheets/adopted style sheets specification](https://github.com/WICG/construct-stylesheets/blob/gh-pages/explainer.md). The full specificaiton is enabled by default in Chrome Canary and according to the Chrome Platform Status page for the feature, it should be turned on by default in Chrome version 73.

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
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `<h1>This will be tomato colored, too</h1>`;
        this.shadowRoot.adoptedStyleSheets = [everythingTomato];
    }
}

customElements('test-el', TestEl);

const testEl = new TestEl;
document.body.appendChild(testEl);
```