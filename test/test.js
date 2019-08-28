const headingStyles = new CSSStyleSheet();
const paragraphStyles = new CSSStyleSheet();

document.adoptedStyleSheets = [ headingStyles, paragraphStyles ];
headingStyles.replace(` h1 {
    color: tomato;
} `).then((sheet) => console.log(`${sheet} styles have been replaced.`));

paragraphStyles.replaceSync(`p {
  color: #1121212;
  font-family: "Operator Mono", "Helvetica Neue";
}`);

setTimeout(() => {
  headingStyles.addRule('*', 'font-family: Helvetica');
}, 1000);
