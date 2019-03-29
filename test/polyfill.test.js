'use strict';
describe('Constructible style sheets', () => {
  let sheet, replaceReturn;

  beforeEach(() => {
    sheet = new CSSStyleSheet();
    replaceReturn = sheet.replace(`* { color: tomato; }`);
  });

  afterEach(() => {
    sheet = null;
    replaceReturn = null;
  });

  it('constructs a new style sheet with replace and replaceSync methods', () => {
    expect(sheet.cssRules).toBeDefined();
    expect(sheet.replace).toBeDefined();
    expect(sheet.replaceSync).toBeDefined();
  });

  it('should return a promise from CSSStyleSheet.prototype.replace', () => {
    expect(replaceReturn instanceof Promise).toBe(true);
  });

  it('should have a rule set', (done) => {
    replaceReturn.then(sheet => {
      expect(sheet.cssRules.length).toBeTruthy();
      done();
    });
  });
});
