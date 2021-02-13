import {
  appliedActionsCursorRegistry,
  deferredDocumentStyleElements,
  locationRegistry,
  observerRegistry,
  sheetMetadataRegistry,
} from './shared';
import {getAdoptedStyleSheet} from './utils';

export function adoptStyleSheets(location) {
  const newStyles = document.createDocumentFragment();
  const sheets = getAdoptedStyleSheet(location);
  const observer = observerRegistry.get(location);

  for (let i = 0, len = sheets.length; i < len; i++) {
    const {adopters, basicStyleElement} = sheetMetadataRegistry.get(sheets[i]);
    let elementToAdopt = adopters.get(location);

    if (elementToAdopt) {
      // This operation removes the style element from the location, so we
      // need to pause watching when it happens to avoid calling
      // adoptAndRestoreStylesOnMutationCallback.
      observer.disconnect();
      newStyles.appendChild(elementToAdopt);

      // Restore styles lost during MutationObserver work in IE & Edge
      if (
        !elementToAdopt.innerHTML ||
        (elementToAdopt.sheet && !elementToAdopt.sheet.cssText)
      ) {
        elementToAdopt.innerHTML = basicStyleElement.innerHTML;
      }

      observer.observe();
    } else {
      // Simple cloneNode won't work because the style element is from the
      // iframe.
      elementToAdopt = document.createElement('style');
      elementToAdopt.innerHTML = basicStyleElement.innerHTML;

      locationRegistry.set(elementToAdopt, location);
      // The index of actions array when we stopped applying actions to the
      // element (e.g., it was disconnected).
      appliedActionsCursorRegistry.set(elementToAdopt, 0);
      adopters.set(location, elementToAdopt);
      newStyles.appendChild(elementToAdopt);
    }

    // If we adopting document stylesheets while document is still loading,
    // we need to remember them to re-adopt later.
    if (location === document.head) {
      deferredDocumentStyleElements.push(elementToAdopt);
    }
  }

  // Since we already removed all elements during appending them to the
  // document fragment, we can just re-add them again.
  location.insertBefore(newStyles, location.lastChild);

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
  const sheets = getAdoptedStyleSheet(location);
  for (let i = 0, len = oldSheets.length; i < len; i++) {
    if (sheets.indexOf(oldSheets[i]) > -1) {
      continue;
    }

    const {adopters} = sheetMetadataRegistry.get(oldSheets[i]);
    const observer = observerRegistry.get(location);
    let styleElement = adopters.get(location);

    // In case the sheet was saved to document.head
    // before the document was ready
    if (!styleElement) {
      styleElement = adopters.get(document.head);
    }

    observer.disconnect();
    styleElement.parentNode.removeChild(styleElement);
    observer.observe();
  }
}
