const headingStyles = new CSSStyleSheet();
const paragraphStyles = new CSSStyleSheet();

document.adoptedStyleSheets = [ headingStyles, paragraphStyles ];
console.log(headingStyles)
headingStyles.replace(` h1 {
    color: tomato;
} `);
