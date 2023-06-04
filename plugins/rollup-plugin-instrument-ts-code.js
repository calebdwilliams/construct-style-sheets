/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call */
import { createInstrumenter } from 'istanbul-lib-instrument';

export default function rollupPluginInstrumentTsCode() {
  return {
    name: 'istanbul',
    async transform(code, filename) {
      const instrumenter = createInstrumenter({
        codeGenerationOptions: { sourceMap: filename, sourceMapWithCode: true },
        esModules: true,
        produceSourceMap: true,
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
