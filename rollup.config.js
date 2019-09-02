const babel = require('rollup-plugin-babel');
const nodeResolve = require('rollup-plugin-node-resolve');

const cwd = process.cwd();

module.exports = {
  input: 'src/index.js',
  output: {
    file: 'dist/adoptedStyleSheets.js',
    format: 'iife',
    name: 'adoptedStyleSheets'
  },
  plugins: [
    nodeResolve(),
    babel(),
  ]
};
