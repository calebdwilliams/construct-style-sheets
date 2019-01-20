(function() {
  'use strict';

  const supportsAdoptedStyleSheets = 'adoptedStyleSheets' in document;  
  if (!supportsAdoptedStyleSheets) {
    const node = Symbol('constructible style sheets');
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.appendChild(iframe);
    
    const appendContent = (location, sheet) => {
      const clone = sheet[node]._sheet.cloneNode(true);
      location.body ? location = location.body : null;
      location.appendChild(clone);
      sheet[node]._adopters.push({ location, clone });
      return clone;
    };

    const updateAdopters = sheet => {
      sheet[node]._adopters.forEach(adopter => {
        adopter.clone.innerHTML = sheet[node]._sheet.innerHTML;
      });
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
        if (!Array.isArray(sheets)) {
          throw new TypeError('Adopted style sheets must be an Array');
        }
        sheets.forEach(sheet => {
          if (!sheet instanceof CSSStyleSheet) {
            throw new TypeError('sdkfljdslfkj');
          }
        });
        const uniqueSheets = [...new Set(sheets)];
        this._adopted = uniqueSheets;
        sheets.forEach(sheet => {
          appendContent(this, sheet);
        });
      }
    };

    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
    Object.defineProperty(document, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
  }
}(undefined));
