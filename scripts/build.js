const {writeFile} = require('fs');
const {resolve} = require('path');
const {rollup} = require('rollup');
const {promisify} = require('util');
const config = require('../rollup.config');

const writeFileAsync = promisify(writeFile);

const cwd = process.cwd();
const detection = "  if ('adoptedStyleSheets' in document) { return; }";

(async () => {
  try {
    const bundle = await rollup(config);
    const generated = await bundle.generate(config.output);
    const {output: [{code}]} = generated;

    const [first, second, ...other] = code.split('\n');
    const result = [first, second, detection, ...other].join('\n');

    await writeFileAsync(resolve(cwd, config.output.file), result, 'utf8');
  } catch (e) {
    console.error(e.stack);
    process.exit(1);
  }
})();
