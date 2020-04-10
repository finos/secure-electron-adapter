const path = require('path');
const { exec } = require('child_process');
const buildDir = path.join(__dirname, '../');
const webpack = require('webpack');

module.exports = {
	mode: process.env.ENV || 'development',
	entry: {
		devIndex: './devIndex'
	},
	target: 'electron-main',
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, '../dist'),
		libraryTarget: 'commonjs2'
	},
	node: {
		__dirname: false,
		__filename: false
	},
	watch: process.env.NODE_ENV === 'development',
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			}
		]
	},
	resolve: {
		extensions: ['.ts', '.js']
	},
	plugins: [
		// This is to get rid of the superagent warning according to their wiki page
		new webpack.DefinePlugin({ 'global.GENTLY': false })
	],
	// Those modules will not be bundled with the library, instead they will be retrieved at runtime in consumer's environment
	// We need electron-winstaller as a bundled dependency in order to have the correct path
	externals: ['electron-packager', 'electron-packager/hooks', 'electron-winstaller', 'bufferutil', 'utf-8-validate', 'osx-temperature-sensor', 'node-notifier']
};
