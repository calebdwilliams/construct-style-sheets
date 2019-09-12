import {
  adoptedSheetsRegistry,
  appliedActionsCursorRegistry,
  locationRegistry,
  observerRegistry,
  sheetMetadataRegistry,
} from './shared';

export function adoptStyleSheets(location) {
  const newStyles = document.createDocumentFragment();
  const sheets = adoptedSheetsRegistry.get(location);

  for (let i = 0, len = sheets.length; i < len; i++) {
    const {adopters, basicStyleElement} = sheetMetadataRegistry.get(sheets[i]);
    const adoptedStyleElement = adopters.get(location);

    if (adoptedStyleElement) {
      // This operation removes the style element from the location, so we
      // need to pause watching when it happens to avoid calling
      // adoptAndRestoreStylesOnMutationCallback.
      const observer = observerRegistry.get(location);

      observer.disconnect();
      newStyles.appendChild(adoptedStyleElement);

      // Restore styles lost during MutationObserver work in IE & Edge
      if (
        !adoptedStyleElement.innerHTML ||
        (adoptedStyleElement.sheet && !adoptedStyleElement.sheet.cssText)
      ) {
        adoptedStyleElement.innerHTML = basicStyleElement.innerHTML;
      }

      observer.observe();
    } else {
      // Simple cloneNode won't work because the style element is from the
      // iframe.
      const newStyleElement = document.createElement('style');
      newStyleElement.innerHTML = basicStyleElement.innerHTML;

      locationRegistry.set(newStyleElement, location);
      // The index of actions array when we stopped applying actions to the
      // element (e.g., it was disconnected).
      appliedActionsCursorRegistry.set(newStyleElement, 0);
      adopters.set(location, newStyleElement);
      newStyles.appendChild(newStyleElement);
    }
  }

  // Since we already removed all elements during appending them to the
  // document fragment, we can just re-add them again.
  if (location === document && document.readyState === 'loading') {
    // If the styles need to be appended to document
    // before the document is ready, put them in the head
    // TODO: Eventually move these to the document once it has parsed
    // to ensure proper cascade order relative to the spec
    document.head.appendChild(newStyles);
  } else if (location.firstChild) {
    location.insertBefore(newStyles, location.firstChild);
  } else {
    location.appendChild(newStyles);
  }

  // We need to apply all actions we have done with the original CSSStyleSheet
  // to each new style element and to any other element that missed last
  // applied actions (e.g., it was disconnected).
  for (let i = 0, len = sheets.length; i < len; i++) {
    const {adopters, actions} = sheetMetadataRegistry.get(sheets[i]);
    const adoptedStyleElement = adopters.get(location);
    const cursor = appliedActionsCursorRegistry.get(adoptedStyleElement);

    if (actions.length > 0) {
      for (let i = cursor, len = actions.length; i < len; i++) {
        const [key, args] = actions[i];
        adoptedStyleElement.sheet[key].apply(adoptedStyleElement.sheet, args);
      }

      appliedActionsCursorRegistry.set(adoptedStyleElement, actions.length - 1);
    }
  }
}

export function removeExcludedStyleSheets(location, oldSheets) {
  const sheets = adoptedSheetsRegistry.get(location);

  for (let i = 0, len = oldSheets.length; i < len; i++) {
    if (sheets.indexOf(oldSheets[i]) > -1) {
      return;
    }

    const {adopters} = sheetMetadataRegistry.get(oldSheets[i]);
    const observer = observerRegistry.get(location);
    const styleElement = adopters.get(location);

    observer.disconnect();
    styleElement.parentNode.removeChild(styleElement);
    observer.observe();
  }
}
