const exec = require('child_process').exec;
const gulp = require('gulp');
const { parallel } = require('gulp');
const ON_DEATH = require('death')({ debug: true });
const webpackStream = require('webpack-stream');
const webpack = require('webpack');
const path = require('path');

let electronChild;
ON_DEATH((signal, err) => {
	console.log('death');
	if (electronChild) electronChild.kill();

	exec('taskkill /F /IM electron.* /T', (err, stdout, stderr) => {
		// Only write the error to console if there is one and it is something other than process not found.
		if (err && err !== 'The process "electron.*" not found.') {
			console.error(err);
		}

		process.exit();
	});
});

process.env.ELECTRON_DEV = true;

/**
 * Build SEA (both main and renderer)
 */
function buildRenderer(done) {
	const stream = gulp.src(path.join(__dirname, './src/sea.js'))
		.pipe(webpackStream(require('./build/webpack.renderer.js'), webpack))
		.pipe(gulp.dest(path.join(__dirname, './dist/')));
	stream.on('end', () => done());
}

function buildMain(done) {
	const stream = gulp.src([path.join(__dirname, './devIndex.js')])
		.pipe(webpackStream(require('./build/webpack.index.js'), webpack))
		.pipe(gulp.dest(path.join(__dirname, './dist/')));
	stream.on('end', () => done());
}

function buildExports(done) {
	const stream = gulp.src(path.join(__dirname, './src/exports.ts'))
		.pipe(webpackStream(require('./build/webpack.exports.js'), webpack))
		.pipe(gulp.dest(path.join(__dirname, './')));
	stream.on('end', () => done());
}

gulp.task('buildSEA', parallel(buildMain, buildRenderer, buildExports));
