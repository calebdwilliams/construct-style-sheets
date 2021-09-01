// Karma configuration
// Generated on Sun Jan 20 2019 23:06:22 GMT-0600 (CST)
const rollupCommonjs = require('@rollup/plugin-commonjs');
const rollupNodeResolve = require('@rollup/plugin-node-resolve').default;
const rollupPluginBabel = require('@rollup/plugin-babel').default;
const rollupPluginTypescript = require('@rollup/plugin-typescript');

const isCI = !!process.env.CI;
const watch = !!process.argv.find((arg) => arg.includes('watch')) && !isCI;
const coverage = !!process.argv.find((arg) => arg.includes('--coverage'));

const extensions = ['.ts', '.js'];

module.exports = (config) => {
  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',

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

    browserNoActivityTimeout: 60000, //default 10000
    browserDisconnectTimeout: 10000, // default 2000
    browserDisconnectTolerance: 1, // default 0
    captureTimeout: 60000,

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'detectBrowsers'],
    client: {
      jasmine: {
        random: false,
      },
    },

    // list of files / patterns to load in the browser
    files: [
      {pattern: 'test/polyfills.js', watched: false},
      {pattern: 'src/index.ts', watched: false},
      {pattern: 'test/init-while-loading.js', watched: false},
      {pattern: 'test/polyfill.test.ts', watched: false},
    ],

    // list of files / patterns to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/polyfills.js': ['rollup'],
      'src/index.ts': ['sourceRollup'],
      'test/polyfill.test.ts': ['rollup'],
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress', coverage && 'coverage-istanbul'].filter(Boolean),

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: watch,

    coverageIstanbulReporter: {
      reports: isCI ? ['lcovonly'] : ['html'],
      dir: '.coverage',
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
          babelHelpers: 'bundled',
          babelrc: false,
          extensions,
          include: [
            'node_modules/@open-wc/**',
            'node_modules/lit-element/**',
            'node_modules/lit-html/**',
            'test/**',
          ],
          presets: [
            '@babel/preset-typescript',
            [
              '@babel/preset-env',
              {
                loose: true,
                targets: {
                  browsers: ['last 2 versions', 'IE 11'],
                },
                shippedProposals: true,
                useBuiltIns: false,
              },
            ],
          ],
          plugins: [
            '@babel/plugin-transform-instanceof',
            'babel-plugin-transform-async-to-promises',
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
            rollupPluginTypescript({
              isolatedModules: true,
              tsconfig: require.resolve('./tsconfig.build.json'),
            }),
            rollupPluginBabel({
              babelHelpers: 'bundled',
              babelrc: false,
              extensions,
              plugins: [coverage && 'babel-plugin-istanbul'].filter(Boolean),
            }),
            require('./plugins/rollup-plugin-inject-code')({
              'index.js': {
                line: 3,
                code: "    if ('adoptedStyleSheets' in document) { return; }\n",
              },
            }),
          ],
          output: {
            format: 'iife',
            name: 'source',
          },
          treeshake: false,
        },
      },
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: !watch,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
  });
};
