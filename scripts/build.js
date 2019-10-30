const {copyFile, mkdir, writeFile} = require('fs');
const {dirname, resolve} = require('path');
const {rollup} = require('rollup');
const {promisify} = require('util');
const config = require('../rollup.config');

const copyFileAsync = promisify(copyFile);
const mkdirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);

const cwd = process.cwd();
const detection = "  if ('adoptedStyleSheets' in document) { return; }";

const build = async resultFile => {
  const bundle = await rollup(config);
  const generated = await bundle.generate(config.output);
  const {
    output: [{code}],
  } = generated;

  const [first, second, ...other] = code.split('\n');
  const result = [first, second, detection, ...other].join('\n');

  await writeFileAsync(resultFile, result, 'utf8');
};

const copy = async () => {
  const input = resolve(cwd, 'src/index.d.ts');
  const output = resolve(cwd, 'dist/adoptedStyleSheets.d.ts');
  await copyFileAsync(input, output);
};

(async () => {
  try {
    const resultFile = resolve(cwd, config.output.file);
    await mkdirAsync(dirname(resultFile), {recursive: true});
    await Promise.all([build(resultFile), copy()]);
  } catch (e) {
    console.error(e.stack);
    process.exit(1);
  }
})();
