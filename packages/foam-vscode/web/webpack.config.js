/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');
const webpack = require('webpack');

/** @type WebpackConfig */
const webExtensionConfig = {
	mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: 'webworker', // extensions run in a webworker context
	entry: {
		extension: './src/extension.ts', // source of the web extension main file
		'test/suite/index': './src/test/suite.ts', // source of the web extension test runner
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, './dist/web'),
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: 'file:///[absolute-resource-path]' 
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
		extensions: ['.ts', '.js', '.tsx', '.jsx'], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			assert: require.resolve('assert'),
      "async_hooks": false,
      child_process: false,
      console: require.resolve("console-browserify"),
      constants: require.resolve("constants-browserify"),
      crypto: require.resolve('crypto-browserify'),
      file: false,
      fs: false,
      inspector: false,
      "jest-circus/runner": false,
      "jest-resolve/build/default_resolver": false,
      module: false,
      net: false,
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      "spdx-exceptions": false,
      "spdx-license-ids": false,
      stream: require.resolve('stream-browserify'),
      url: require.resolve('url'),
      util: require.resolve('util'),
      vm: require.resolve('vm-browserify'),
      v8: false,
      "worker_threads": false
		},
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
      },
      {
        test: /\.md$/,
        loader: "null-loader"
      },
      {
        test: /\.d\.ts$/,
        loader: "null-loader"
      },
      {
        test: /LICENSE$/,
        loader: "null-loader"
      },
		],
	},
	plugins: [
		new webpack.ProvidePlugin({
			process: 'process/browser.js', // provide a shim for the global `process` variable
		}),
	],
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'nosources-source-map', // create a source map that points to the original source file,
};

module.exports = [webExtensionConfig];
