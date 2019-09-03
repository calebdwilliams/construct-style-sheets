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

  sheets.forEach(sheet => {
    const {adopters, basicStyleElement} = sheetMetadataRegistry.get(
      sheet,
    );
    const adoptedStyleElement = adopters.get(location);

    if (adoptedStyleElement) {
      // This operation removes the style element from the location, so we
      // need to pause watching when it happens to avoid calling
      // adoptAndRestoreStylesOnMutationCallback.
      const observer = observerRegistry.get(location);

      observer.disconnect();
      newStyles.appendChild(adoptedStyleElement);
      observer.observe();
    } else {
      const clone = basicStyleElement.cloneNode(true);
      locationRegistry.set(clone, location);
      // The index of actions array when we stopped applying actions to the
      // element (e.g., it was disconnected).
      appliedActionsCursorRegistry.set(clone, 0);
      adopters.set(location, clone);
      newStyles.appendChild(clone);
    }
  });

  // Since we already removed all elements during appending them to the
  // document fragment, we can just re-add them again.
  if (location.firstChild) {
    location.insertBefore(newStyles, location.firstChild);
  } else {
    location.appendChild(newStyles);
  }

  // We need to apply all actions we have done with the original CSSStyleSheet
  // to each new style element and to any other element that missed last
  // applied actions (e.g., it was disconnected).
  sheets.forEach(sheet => {
    const {adopters, actions} = sheetMetadataRegistry.get(sheet);
    const adoptedStyleElement = adopters.get(location);
    const cursor = appliedActionsCursorRegistry.get(adoptedStyleElement);

    if (actions.length > 0) {
      for (let i = cursor; i < actions.length; i++) {
        const [key, args] = actions[i];
        adoptedStyleElement.sheet[key](...args);
      }

      appliedActionsCursorRegistry.set(adoptedStyleElement, actions.length - 1);
    }
  });
}

export function removeExcludedStyleSheets(location, oldSheets) {
  const sheets = adoptedSheetsRegistry.get(location);

  oldSheets.forEach(sheet => {
    if (sheets.indexOf(sheet) > -1) {
      return;
    }

    const {adopters} = sheetMetadataRegistry.get(sheet);
    const observer = observerRegistry.get(location);
    const styleElement = adopters.get(location);

    observer.disconnect();
    styleElement.parentNode.removeChild(styleElement);
    observer.observe();
  });
}
