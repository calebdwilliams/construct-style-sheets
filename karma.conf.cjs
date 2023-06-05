/* eslint-disable @typescript-eslint/no-require-imports,import/unambiguous */
// Karma configuration
// Generated on Sun Jan 20 2019 23:06:22 GMT-0600 (CST)
const rollupCommonjs = require('@rollup/plugin-commonjs');
const rollupNodeResolve = require('@rollup/plugin-node-resolve').default;
const rollupPluginBabel = require('@rollup/plugin-babel').default;
const rollupPluginInstrumentTsCode = require('./plugins/rollup-plugin-instrument-ts-code.cjs');
const babelConfig = require('./babel.config.json');

const isCI = !!process.env.CI;
const watch = !!process.argv.find((arg) => arg.includes('watch')) && !isCI;
const coverage = !!process.argv.find((arg) => arg.includes('--coverage'));

const extensions = ['.ts', '.js'];
const rollupPluginBabelConfig = {
  ...babelConfig,
  babelHelpers: 'bundled',
  babelrc: false,
  extensions,
  plugins: [
    ...babelConfig.plugins,
    '@babel/plugin-transform-instanceof',
    'babel-plugin-transform-async-to-promises',
  ],
};

module.exports = (config) => {
  config.set({
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-firefox-launcher'),
      require('karma-safarinative-launcher'),
      require('karma-ie-launcher'),
      require('karma-edge-launcher'),
      require('karma-coverage-istanbul-reporter'),
      require('karma-detect-browsers'),
      require('karma-rollup-preprocessor'),
    ],

    frameworks: ['jasmine', 'detectBrowsers'],

    client: {
      jasmine: {
        random: false,
      },
    },

    files: [
      { pattern: 'test/polyfills.js', watched: false },
      { pattern: 'src/index.ts', watched: false },
      { pattern: 'test/init-while-loading.js', watched: false },
      { pattern: 'test/polyfill.test.ts', watched: false },
    ],

    preprocessors: {
      'test/polyfills.js': ['rollup'],
      'src/index.ts': ['sourceRollup'],
      'test/polyfill.test.ts': ['rollup'],
    },

    reporters: ['progress', coverage && 'coverage-istanbul'].filter(Boolean),

    coverageIstanbulReporter: {
      reports: isCI ? ['lcovonly'] : ['html'],
      dir: '.coverage',
      includeAllSources: true,
      combineBrowserReports: true,
      skipFilesWithNoCoverage: true,
    },

    customLaunchers: {
      Safari: {
        base: 'SafariNative',
      },
    },

    detectBrowsers: {
      usePhantomJS: false,
      preferHeadless: true,
      postDetection(availableBrowsers) {
        return availableBrowsers.filter(
          (browser) => browser !== 'SafariTechPreview' && browser !== 'Edge',
        );
      },
    },

    rollupPreprocessor: {
      plugins: [
        rollupCommonjs({
          include: 'node_modules/**',
          exclude: 'node_modules/@open-wc/**',
        }),
        rollupNodeResolve({
          extensions,
        }),
        rollupPluginBabel({
          ...rollupPluginBabelConfig,
          include: [
            'node_modules/@open-wc/**',
            'node_modules/lit-element/**',
            'node_modules/lit-html/**',
            'test/**',
          ],
        }),
      ],
      output: {
        format: 'iife',
        name: 'tests',
      },
      treeshake: true,
    },

    customPreprocessors: {
      sourceRollup: {
        base: 'rollup',
        options: {
          plugins: [
            rollupNodeResolve({
              extensions,
            }),
            rollupPluginBabel({
              ...rollupPluginBabelConfig,
              include: ['src/**'],
            }),
            coverage && rollupPluginInstrumentTsCode(),
          ].filter(Boolean),
          output: {
            format: 'iife',
            name: 'source',
            sourcemap: 'inline',
          },
          treeshake: false,
        },
      },
    },

    autoWatch: watch,
    singleRun: !watch,
  });
};
