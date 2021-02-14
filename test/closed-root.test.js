let root;
let el;
let closedSheet = new CSSStyleSheet();

class ClosedRoot extends HTMLElement {
  connectedCallback() {
    root = this.attachShadow({ mode: 'closed' });
    root.adoptedStyleSheets = [closedSheet];
    root.innerHTML = `<h1>Hello world</h1>`;
    this.target = root.querySelector('h1');
  }
}

customElements.define('closed-root', ClosedRoot);

describe('Closed shadow roots', () => {
  beforeEach(async() => {
    el = document.createElement('closed-root');
    document.body.append(el);
    closedSheet.replace(`h1 { color: rgb(33, 33, 33); }`);
  });

  afterEach(() => {
    el.remove();
    el = null;
  });

  it('works with closed shadow roots', () => {
    expect(
      window.getComputedStyle(el.target).color
    ).toBe('rgb(33, 33, 33)');
  });

  it('will update sheets in a closed shadow root', () => {
    expect(
      window.getComputedStyle(el.target).color
    ).toBe('rgb(33, 33, 33)');

    closedSheet.replaceSync('h1 { color: rgb(255, 255, 0); }');

    expect(
      window.getComputedStyle(el.target).color
    ).toBe('rgb(255, 255, 0)');
  });
});
