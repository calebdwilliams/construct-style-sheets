const {resolve} = require('path');

const cwd = process.cwd();
const coverage = process.argv.find(arg => arg.includes('coverage'));

const paths = {
  babelrc: resolve(cwd, '.babelrc'),
  nodeModules: resolve(cwd, 'node_modules'),
  openWc: resolve(cwd, 'node_modules/@open-wc'),
  polyfills: resolve(cwd, 'test/polyfills.js'),
  src: resolve(cwd, 'src'),
  test: resolve(cwd, 'test/polyfill.test.js'),
};

module.exports = {
  devtool: 'source-maps',
  entry: paths.test,
  mode: 'development',
  resolve: {
    modules: ['node_modules', paths.nodeModules],
  },
  module: {
    strictExportPresence: true,
    rules: [
      coverage && {
        test: /\.js$/,
        use: [
          {
            loader: 'istanbul-instrumenter-loader',
            options: {
              esModules: true,
            },
          },
        ],
        include: [paths.src],
      },
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              cacheDirectory: true,
              cacheCompression: false,
              extends: paths.babelrc,
            },
          },
        ],
        include: [paths.openWc, paths.polyfills, paths.src, paths.test],
      },
    ].filter(Boolean),
  },
  performance: {
    hints: false,
  },
};
