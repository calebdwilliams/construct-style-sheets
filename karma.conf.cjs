/* eslint-disable @typescript-eslint/no-require-imports,import/unambiguous */
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
      require('karma-babel-preprocessor')
    ],

    frameworks: ['jasmine'],

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
      'test/init-while-loading.js': ['rollup'],
      'test/polyfill.test.ts': ['rollup'],
      'node_modules/jasmine-core/lib/jasmine-core/jasmine.js': ['babel']
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

    babelPreprocessor: {
      options: {
        ...babelConfig,
        presets: babelConfig.presets.map(([name, options]) => name.includes('env') ? [name, {
          ...options,
          modules: false,
        }] : [name, options])
      }
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
