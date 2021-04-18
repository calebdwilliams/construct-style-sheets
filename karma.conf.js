// Karma configuration
// Generated on Sun Jan 20 2019 23:06:22 GMT-0600 (CST)
const {readFileSync} = require('fs');
const {resolve} = require('path');

const isCI = !!process.env.CI;
const watch = !!process.argv.find(arg => arg.includes('watch')) && !isCI;
const coverage = !!process.argv.find(arg => arg.includes('--coverage'));

const babelrc = JSON.parse(
  readFileSync(resolve(process.cwd(), '.babelrc'), 'utf8'),
);

module.exports = config => {
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
      {pattern: 'src_new/index.js', watched: false},
      {pattern: 'test/init-while-loading.js', watched: false},
      {pattern: 'test/polyfill.test.js', watched: false},
    ],

    // list of files / patterns to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/polyfills.js': ['rollup'],
      'src_new/index.js': ['sourceRollup'],
      'test/polyfill.test.js': ['rollup'],
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
      reports: ['html', 'lcovonly'],
      dir: '.coverage',
      combineBrowserReports: true,
      skipFilesWithNoCoverage: true,
      'report-config': {
        html: {subdir: 'html'},
        lcovonly: {subdir: 'lcov'},
      },
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
          browser =>
            browser !== 'SafariTechPreview' &&
            browser !== 'Edge' &&
            browser !== 'IE',
          // !browser.includes('Firefox') &&
          // !browser.includes('Chrome'),
        );
      },
    },

    rollupPreprocessor: {
      plugins: [
        require('rollup-plugin-commonjs')({
          include: 'node_modules/**',
          exclude: 'node_modules/@open-wc/**',
        }),
        require('rollup-plugin-node-resolve')(),
        require('rollup-plugin-babel')({
          babelrc: false,
          include: ['node_modules/@open-wc/**', 'test/**'],
          ...babelrc,
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
    },

    customPreprocessors: {
      sourceRollup: {
        base: 'rollup',
        options: {
          plugins: [
            require('rollup-plugin-node-resolve')(),
            require('rollup-plugin-babel')({
              babelrc: false,
              ...babelrc,
              plugins: [coverage && 'babel-plugin-istanbul'].filter(Boolean),
            }),
            require('./plugins/rollup-plugin-inject-code')({
              'index.js': {
                line: 3,
                code: "  if ('adoptedStyleSheets' in document) { return; }\n",
              },
            }),
          ],
          output: {
            format: 'iife',
            name: 'tests',
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
