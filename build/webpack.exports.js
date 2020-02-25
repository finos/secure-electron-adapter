const path = require('path');

module.exports = {
	mode: process.env.ENV || 'development',
	entry: {
		exports: './src/exports.js',
	},
	target: 'electron-main',
	node: {
		__dirname: false,
		__filename: false
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, '../'),
		libraryTarget: 'commonjs2'
	},
	watch: process.env.NODE_ENV === 'development',
	module: {
		rules: []
	},
	resolve: {
		extensions: ['.js']
	},
	plugins: [
	],
	// Those modules will not be bundled with the library, instead they will be retrieved at runtime in consumer's environment
	// We need electron-winstaller as a bundled dependency in order to have the correct path
	externals: ['electron-packager', 'electron-packager/hooks', 'electron-winstaller', 'bufferutil', 'utf-8-validate', 'osx-temperature-sensor', 'node-notifier']
};
