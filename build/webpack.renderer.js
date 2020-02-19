const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

const defaultConfig = {
	devtool: 'source-map',
	mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
	entry: {
		e2o: path.join(__dirname, '../src/e2o.js')
	},
	target: 'electron-renderer',
	plugins: [
		new CaseSensitivePathsPlugin(),
		new webpack.optimize.OccurrenceOrderPlugin()
	],
	output: {
		path: path.join(__dirname, '..', '/dist'),
		filename: '[name].js',
		publicPath: '/',
		chunkFilename: '[name]-[contenthash]-chunk.js'
	},
	watch: process.env.NODE_ENV === 'development',
	module: {
		noParse: /node_modules\/json-schema\/lib\/validate\.js/,
		rules: []
	},
	resolve: {
		extensions: ['.js', '.jsx', '.scss']
	}
};

module.exports = defaultConfig;
