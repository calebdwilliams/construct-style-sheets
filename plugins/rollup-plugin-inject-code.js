module.exports = ({insertions, lineProcessor = (line) => line}) => ({
  name: 'inject-code',
  async generateBundle(_, assets) {
    Object.entries(insertions).forEach(([chunkName, chunkInsertions]) => {
      const chunk = assets[chunkName];

      const lines = chunk.code.split('\n').map(lineProcessor);

      for (const {line, code} of chunkInsertions) {
        switch (line) {
          case -Infinity:
            lines.unshift(code);
            break;
          case Infinity:
            lines.push(code);
            break;
          default:
            lines.splice(line, 0, code);
            break;
        }

        chunk.code = lines.join('\n');
      }
    });
  },
});
