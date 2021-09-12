const {createInstrumenter} = require('istanbul-lib-instrument');

module.exports = function () {
  return {
    name: 'istanbul',
    async transform(code, filename) {
      const instrumenter = createInstrumenter({
        produceSourceMap: true,
        esModules: true,
        codeGenerationOptions: {sourceMap: filename, sourceMapWithCode: true},
      });

      return {
        code: instrumenter.instrumentSync(code, filename, {
          ...this.getCombinedSourcemap(),
        }),
        map: instrumenter.lastSourceMap(),
      };
    },
  };
};
