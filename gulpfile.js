const exec = require('child_process').exec;
const gulp = require('gulp');
const electron = require('electron');
const proc = require('child_process');
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

function launchElectron(env) {
	let manifest = 'http://localhost:3375/configs/openfin/manifest-local.json';
	if (env === 'dev') {
		manifest = 'https://dev.finsemble.com/configs/openfin/manifest-dev.json';
	}
	electronChild = exec(`set ELECTRON_DEV=true && node_modules\\electron\\dist\\electron.exe index.js --remote-debugging-port=9090 --manifest ${manifest}`,
		{

		}, (error, stdout, stderr) => {
		});

	electronChild.stdout.on('data', (data) => {
		console.log(data.toString());
		if (data.toString().indexOf("Finished 'dev:noLaunch'") > -1) {
			console.log('dev server is up');
		}
	});

	electronChild.stderr.on('data', (data) => {
		console.error('stderr:', data.toString());
	});

	electronChild.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
	});
	process.on('exit', () => {
		electronChild.kill();
	});
}
function launchSeedServer(env) {
	const seedServer = exec('node ./node_modules/gulp/bin/gulp.js  dev:noLaunch --gulpfile ./finsemble-seed/gulpfile.js', (error, stdout, stderr) => {
	});
	seedServer.stdout.on('data', (data) => {
		console.log('server Output:', data);
		if (data.indexOf("Finished 'dev:noLaunch'") > -1) {
			launchElectron(env);
		}
	});

	seedServer.stderr.on('data', (data) => {
		console.error('server error:', data);
	});

	seedServer.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
	});
	process.on('exit', () => {
		seedServer.kill();
	});
}


// Run the seed server (e.g. localhost:3375) dependency, which then launches electron on the desktop
gulp.task('default', () => {
	// launchSeedServer('local');
});

// Run just electron. Assumes that a Finsemble server is already running (for instance running finsemble-seed in a separate window on port 3375)
gulp.task('dev', () => {
	launchElectron('dev');
});
/**
 * Build our e2o preload file. We must do this for sandbox mode
 */
gulp.task('buildE2O', () => gulp.src(path.join(__dirname, './src/e2o.js'))
	.pipe(webpackStream(require('./build/e2o.js'), webpack))
	.pipe(gulp.dest(path.join(__dirname, './dist/'))));
