const path = require('path');
const webpack = require('webpack');

/** @typedef {import('webpack').Configuration} WebpackConfig **/
/** @type WebpackConfig */
const webExtensionConfig = {
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  target: 'webworker', // extensions run in a webworker context
  entry: {
    extension: './src/extension.ts', // source of the web extension main file,
    'test/web/index': './src/test/web/index.ts',
  },
  output: {
    clean: true,
    filename: '[name].js',
    path: path.join(__dirname, './../out/web'),
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../../[resource-path]',
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js'], // support ts-files and js-files
    alias: {
      // Overwrite wikilink embedding as it will not work in the current setup on web
      [path.resolve(__dirname, '../src/features/preview/wikilink-embed.ts')]:
        path.resolve(
          __dirname,
          '../src/web/features/preview/wikilink-embed.ts'
        ),
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: require.resolve('assert'),
      crypto: require.resolve('crypto-browserify'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      'process/browser': require.resolve('process/browser'),
      stream: require.resolve('stream-browserify'),
      tty: require.resolve('tty-browserify'),
      util: require.resolve('util/'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser', // provide a shim for the global `process` variable
    }),
  ],
  externals: {
    vscode: 'commonjs vscode', // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: 'nosources-source-map', // create a source map that points to the original source file
};
module.exports = [webExtensionConfig];
