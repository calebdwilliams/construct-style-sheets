// This code needs to run after the polyfill has loaded but before initPolyfill has been run
// Only for modern browsers that support Web Components.
if ('ShadowRoot' in window) {
  const div = document.createElement('custom-elem');
  div.id = 'added-while-loading';
  const shadowRoot = div.attachShadow({mode: 'open'});
  const spanWithText = document.createElement('span');
  spanWithText.innerText = 'I should be blue';
  shadowRoot.appendChild(spanWithText);

  const sheet = new CSSStyleSheet();
  sheet.replaceSync('span { color: rgb(0, 0, 255) }');
  shadowRoot.adoptedStyleSheets = [sheet];
  window.s = shadowRoot;
  document.body.appendChild(div);
}
