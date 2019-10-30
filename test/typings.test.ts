import '../src';

// CSSStyleSheet
const sheet: CSSStyleSheet = new CSSStyleSheet();
sheet.replaceSync('* { color: tomato; }');
sheet
  .replace('@import "./somefile.css"; * { color: tomato; }')
  .then(sheet => sheet.removeRule(1));
sheet.addRule('.foo', 'color: white', 0);

// Document
document.adoptedStyleSheets = [sheet];

// Custom Elements

// @ts-ignore
class Foo extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({mode: 'open'});
    root.adoptedStyleSheets = [sheet];
  }
}
