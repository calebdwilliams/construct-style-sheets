module.exports = (options) => ({
  name: 'add-detection',
  async generateBundle(_, assets) {
    for (const chunkName in options) {
      const chunk = assets[chunkName];
      const {line, code} = options[chunkName];

      const lines = chunk.code.split('\n');
      lines.splice(line, 0, code);
      chunk.code = lines.join('\n');
    }
  }
});
