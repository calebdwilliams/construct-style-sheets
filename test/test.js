const headingStyles = new CSSStyleSheet();
const paragraphStyles = new CSSStyleSheet();

document.adoptedStyleSheets = [ headingStyles, paragraphStyles ];
headingStyles.replace(` h1 {
    color: tomato;
} `).then((sheet) => {
  console.log(`${sheet} styles have been replaced.`)
  console.assert(sheet === headingStyles, 'not the same', 'yass')
});

paragraphStyles.replaceSync(`p {
  color: #ab2121;
  font-family: "Operator Mono", "Helvetica Neue";
}`);

setTimeout(() => {
  headingStyles.addRule('*', 'font-family: monospace');
}, 1000);
