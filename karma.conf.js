// Karma configuration
// Generated on Sun Jan 20 2019 23:06:22 GMT-0600 (CST)

const webpack = require('./webpack.config');

const isCI = !!process.env.CI;
const watch = !!process.argv.find(arg => arg.includes('watch')) && !isCI;
const coverage = !!process.argv.find(arg => arg.includes('--coverage'));

module.exports = function(config) {
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
      require('karma-webpack'),
      require('karma-coverage-istanbul-reporter'),
    ],

    browserNoActivityTimeout : 60000, //default 10000
    browserDisconnectTimeout : 10000, // default 2000
    browserDisconnectTolerance : 1, // default 0
    captureTimeout: 60000,

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine', 'detectBrowsers'],

    // list of files / patterns to load in the browser
    files: ['test/polyfill.test.js'],

    // list of files / patterns to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {'test/polyfill.test.js': ['webpack']},

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: coverage ? ['progress', 'coverage-istanbul'] : ['progress'],

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
      fixWebpackSourcePaths: true,
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
        return availableBrowsers.filter(browser => browser !== 'IE');
      },
    },

    webpack,

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: !watch,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
  });
};
