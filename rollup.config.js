const tsc = require('@rollup/plugin-typescript');
const cleanup = require('rollup-plugin-cleanup');
const copy = require('rollup-plugin-copy');
const nodeResolve = require('@rollup/plugin-node-resolve').default;
const injectCode = require('./plugins/rollup-plugin-inject-code');

const extensions = ['.ts', '.js'];

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/adoptedStyleSheets.js',
      format: 'iife',
      name: 'adoptedStyleSheets',
      plugins: [
        injectCode({
          insertions: {
            'adoptedStyleSheets.js': [
              {
                line: 3,
                code: "    if (typeof document === 'undefined' || 'adoptedStyleSheets' in document) { return; }\n",
              },
            ],
          },
        }),
      ],
    },
    {
      file: 'dist/adoptedStyleSheets.mjs',
      format: 'esm',
      plugins: [
        injectCode({
          insertions: {
            'adoptedStyleSheets.mjs': [
              {
                line: -Infinity,
                code: "if (typeof document === 'undefined' || 'adoptedStyleSheets' in document) {\n",
              },
              {
                line: Infinity,
                code: '}',
              },
            ],
          },
          lineProcessor(line) {
            return `    ${line}`;
          },
        }),
      ],
    },
  ],
  plugins: [
    nodeResolve({
      extensions,
    }),
    tsc({
      isolatedModules: true,
      tsconfig: require.resolve('./tsconfig.build.json'),
    }),
    cleanup({
      extensions,
    }),
    copy({
      targets: [
        {
          src: 'src/typings.d.ts',
          dest: 'dist',
          rename: 'adoptedStyleSheets.d.ts',
        },
      ],
    }),
  ],
};
