(function() {
  'use strict';
  console.clear();
  const supportsAdoptedStyleSheets = 'adoptedStyleSheets' in document;  
  if (!supportsAdoptedStyleSheets) {
    const node = Symbol('constructible style sheets');
    const constructed = Symbol('constructed');
    const removalListener = Symbol('listener');
    const iframe = document.createElement('iframe');
    const mutationCallback = mutations => {
      mutations.forEach(mutation => {
        const { removedNodes } = mutation;
        removedNodes.forEach(removed => {
          if (removed[constructed]) {
            setTimeout(() => {
              removed[constructed].appendChild(removed);
            });
          }
        });
      });
    };
    const observer = new MutationObserver(mutationCallback);
    observer.observe(document.body, { childList: true });
    iframe.hidden = true;
    document.body.appendChild(iframe);
    
    const appendContent = (location, sheet) => {
      const clone = sheet[node]._sheet.cloneNode(true);
      location.body ? location = location.body : null;
      clone[constructed] = location;  
      sheet[node]._adopters.push({ location, clone });
      location.appendChild(clone);
      return clone;
    };

    const updateAdopters = sheet => {
      sheet[node]._adopters.forEach(adopter => {
        adopter.clone.innerHTML = sheet[node]._sheet.innerHTML;
      });
    };
    
    const onShadowRemoval = (root, observer) => event => {
      const shadowRoot = event.target.shadowRoot;
      if (shadowRoot && shadowRoot.adoptedStyleSheets.length) {
        const adoptedStyleSheets = shadowRoot.adoptedStyleSheets;
        adoptedStyleSheets
          .map(sheet => sheet[node])
          .map(sheet => {
          sheet._adopters = sheet._adopters.filter(adopter => adopter.location !== shadowRoot);
        });
      }
      observer.disconnect();
    };

    class _StyleSheet {
      constructor() {
        this._adopters = [];
        const sheet = document.createElement('style');
        iframe.contentWindow.document.body.appendChild(sheet);
        this._sheet = sheet;
        sheet.sheet[node] = this;
        return sheet.sheet;
      }
    }

    CSSStyleSheet.prototype.replace = function(contents) {
      return new Promise((resolve, reject) => {
        if (this[node]) {
          this[node]._sheet.innerHTML = contents;
          resolve(this[node]._sheet.sheet);
          updateAdopters(this);
        } else {
          reject('replace can only be called on a constructed style sheet');
        }
      });
    };

    CSSStyleSheet.prototype.replaceSync = function(contents) {
      if (this[node]) {
        this[node]._sheet.innerHTML = contents;
        updateAdopters(this);
        return this[node]._sheet.sheet;
      } else {
        throw new TypeError('replaceSync can only be called on a constructed style sheet');
      }
    };

    window.CSSStyleSheet = _StyleSheet;
    const adoptedStyleSheetsConfig = {
      get() {
          return this._adopted || [];
      },
      set(sheets) {
        const observer = new MutationObserver(mutationCallback);
        observer.observe(this, { childList: true });
        if (!Array.isArray(sheets)) {
          throw new TypeError('Adopted style sheets must be an Array');
        }
        sheets.forEach(sheet => {
          if (!sheet instanceof CSSStyleSheet) {
            throw new TypeError('Adopted style sheets must be of type CSSStyleSheet');
          }
        });
        const uniqueSheets = [...new Set(sheets)];
        this._adopted = uniqueSheets;
        
        if (this.isConnected) {
          sheets.forEach(sheet => {
            appendContent(this, sheet);
          });
        }
        
        const removalListener = onShadowRemoval(this, observer);
        this[removalListener] = removalListener;
        this.addEventListener('DOMNodeRemoved', removalListener, true);
      }
    };

    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
    Object.defineProperty(document, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
  }
}(undefined));
