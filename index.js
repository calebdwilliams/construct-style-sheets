(function() {
  'use strict';

  const supportsAdoptedStyleSheets = 'adoptedStyleSheets' in document;  
  if (!supportsAdoptedStyleSheets) {
    const iframe = document.createElement('iframe');
    iframe.hidden = true;
    document.body.appendChild(iframe);
    
    class _StyleSheet {
    constructor() {
        this._adopters  = [];
        const sheet = document.createElement('style');
        iframe.contentWindow.document.body.appendChild(sheet);
        this._sheet = sheet;
        const proto = CSSStyleSheet.prototype;
        for (let prop in proto) {
        Object.defineProperty(this, prop, {
            get() {
            const protoProp = proto[prop];
            if (typeof protoProp === 'function') {
                this[prop] = protoProp.bind(this._sheet);
            } else {
                this[prop] = protoProp;
            }
            }
        });
        }
    }

    replace(string) {
        return new Promise((resolve, reject) => {
        this._sheet.innerHTML = string;
        resolve(this);
        this._updateAdopters();
        });
    }

    replaceSync(string) {
        this._sheet.innerHTML = string;
        this._updateAdopters();
        return this;
    }

    _appendContent(location) {
        const clone = this._sheet.cloneNode(true);
        location.body ? location = location.body : null;
        location.appendChild(clone);
        this._adopters.push({ location, clone });
    }

    _updateAdopters() {
        this._adopters.forEach(adopter => {
        adopter.location.removeChild(adopter.clone);
        this._appendContent(adopter.location)
        });
    }
    }

    window.CSSStyleSheet = _StyleSheet;
    const adoptedStyleSheetsConfig = {
    get() {
        return this._adopted || [];
    },
    set(sheets) {
        if (!Array.isArray(sheets)) {
        throw new TypeError('sdlfjk');
        }
        sheets.forEach(sheet => {
        if (!sheet instanceof _StyleSheet) {
            throw new TypeError('sdkfljdslfkj');
        }
        });
        const uniqueSheets = [...new Set(sheets)];
        this._adopted = uniqueSheets;
        sheets.forEach(sheet => {
        sheet._appendContent(this);
        })
    }
    };

    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
    Object.defineProperty(document, 'adoptedStyleSheets', adoptedStyleSheetsConfig);
  }
}(undefined));
