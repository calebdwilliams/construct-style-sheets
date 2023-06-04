/* eslint-disable camelcase */
import babel from '@rollup/plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import injectCode from './plugins/rollup-plugin-inject-code.js';
import terser from '@rollup/plugin-terser';

const extensions = ['.ts', '.js'];

const rollupConfig = {
  input: 'src/index.ts',
  output: {
    file: 'dist/adoptedStyleSheets.js',
    format: 'iife',
    name: 'adoptedStyleSheets',
  },
  plugins: [
    nodeResolve({
      extensions,
    }),
    babel({ babelHelpers: 'bundled', extensions }),
    copy({
      targets: [
        {
          dest: 'dist',
          rename: 'adoptedStyleSheets.d.ts',
          src: 'src/typings.d.ts',
        },
      ],
    }),
    injectCode({
      'adoptedStyleSheets.js': {
        code: "  if (typeof document === 'undefined' || 'adoptedStyleSheets' in document) { return; }\n",
        line: 3,
      },
    }),
    terser({
      compress: {
        booleans_as_integers: true,
        ecma: 5,
        passes: 3,
        pure_funcs: [
          'unique',
          'diff',
          'getShadowRoot',
          'isElementConnected',
          'rejectImports',
          'removeNode',
        ],
        toplevel: true,
        unsafe_proto: true,
        unsafe_symbols: true,
      },
    }),
  ],
};

export default rollupConfig;
