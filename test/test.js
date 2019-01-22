const headingStyles = new CSSStyleSheet();
const paragraphStyles = new CSSStyleSheet();

document.adoptedStyleSheets = [ headingStyles, paragraphStyles ];

headingStyles.replace(` h1 {
    color: tomato;
} `);
