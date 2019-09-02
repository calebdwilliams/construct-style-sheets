import {adoptStyleSheets} from './adopt';
import {hasShadyCss, locationRegistry, observerRegistry} from './shared';

function adoptAndRestoreStylesOnMutationCallback(mutations) {
  mutations.forEach(({addedNodes, removedNodes}) => {
    // When any style is removed, we need to re-adopt all the styles because
    // otherwise we can break the order of appended styles which will affect the
    // rules overriding.
    for (let i = 0; i < removedNodes.length; i++) {
      const location = locationRegistry.get(removedNodes[i]);

      if (location) {
        adoptStyleSheets(location);
      }
    }

    // When the new custom element is added in the observing location, we need
    // to adopt its style sheets. However, Mutation Observer can track only
    // the top level of children while we need to catch each custom element
    // no matter how it is nested. To go through the nodes we use the
    // NodeIterator.
    if (!hasShadyCss) {
      for (let i = 0; i < addedNodes.length; i++) {
        const iter = document.createNodeIterator(
          addedNodes[i],
          NodeFilter.SHOW_ELEMENT,
          node =>
            node.shadowRoot && node.shadowRoot.adoptedStyleSheets.length > 0
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
          // IE createNodeIterator method accepts 5 args
          null,
          false,
        );

        let node;

        while ((node = iter.nextNode())) {
          adoptStyleSheets(node.shadowRoot);
        }
      }
    }
  });
}

export function createObserver(location) {
  const observer = new MutationObserver(
    adoptAndRestoreStylesOnMutationCallback,
  );

  const observerTool = {
    observe() {
      observer.observe(location, {childList: true, subtree: true});
    },
    disconnect() {
      observer.disconnect();
    },
  };

  observerRegistry.set(location, observerTool);

  observerTool.observe();
}
