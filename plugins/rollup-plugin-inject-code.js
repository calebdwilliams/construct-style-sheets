/* eslint-disable @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call */
export default function rollupPluginInjectCode(options) {
  return {
    name: 'inject-code',
    async renderChunk(code, { fileName }) {
      const _options = options[fileName];

      if (_options) {
        const lines = code.split('\n');
        lines.splice(_options.line, 0, _options.code);
        return lines.join('\n');
      }

      return code;
    },
  };
}
