/**
 * This file is for opening up SEA in the dev environment. It create a background process and launches electron in it.
 */

const { exec, execSync } = require('child_process');
const path = require('path');
const process = require('process');
const ON_DEATH = require('death')({ debug: false });
const logger = require('../src/logger')();

const env = process.env;
// Honestly, not sure what this is. Took it from the seed project
function envOrArg(name, defaultValue) {
	let lc = name.toLowerCase();
	let uc = name.toUpperCase();
	const cc = name.replace(/(-|_)([a-z])/g, g => g[1].toUpperCase());

	// Check environment variables
	if (env[lc]) return env[lc];
	if (env[uc]) return env[uc];

	// Check command line arguments
	lc = `--${lc}:`;
	uc = `--${uc}:`;
	let rc = null;
	process.argv.forEach((arg) => {
		if (arg.startsWith(lc)) rc = arg.split(lc)[1];
		if (arg.startsWith(uc)) rc = arg.split(uc)[1];
	});

	// Look in startupConfig. Not sure what this is doing.
	if (!rc) {
		// rc = startupConfig[env.NODE_ENV][cc] || startupConfig[env.NODE_ENV][lc] || startupConfig[env.NODE_ENV][uc];
	}
	rc = rc || defaultValue;
	return rc;
}

module.exports = function (params, cb) {
	let electronProcess = null;
	const manifest = params.manifest;
	process.env.ELECTRON_DEV = true;

	// @todo try to move to the top and see if it breaks anything...
	const execPath = require('electron');
	logger.debug('seaLauncher. Electron executable path:', execPath);
	const electronPath = execPath;
	let debugArg = '';
	debugArg = envOrArg('breakpointOnStart') === 'true' ? '--inspect-brk=5858' : '--inspect=5858';

	const indexPath = path.join(__dirname, './dist/devIndex.js');
	const command = `set ELECTRON_DEV=true && "${electronPath}" "${indexPath}" --remote-debugging-port=9090 ${debugArg} --manifest ${manifest}`;
	logger.log('APPLICATION LIFECYCLE: Electron shell command:', command);

	const killElectronProcesses = () => {
		try {
			execSync('taskkill /F /IM electron.* /T');
		} catch (e) {
			logger.error('No Electron processes running to kill.');
		}
		process.exit();
	};

	ON_DEATH((signal, err) => {
		if (electronProcess) {
			logger.log('SEA Shutdown. Killing electron processes.');
			electronProcess.kill();
		}
		killElectronProcesses();
	});

	electronProcess = exec(command,
		{
			cwd: path.join(__dirname, '../'),
			env: {
				...process.env,
				chromiumFlags: params.chromiumFlags,
			}
		}, (err) => {
			logger.error(err);
		});

	electronProcess.stdout.on('data', (data) => {
		logger.log('SEA:', data.toString());
	});

	electronProcess.stderr.on('data', (data) => {
		logger.error('stderr:', data.toString());
	});

	electronProcess.on('close', (code) => {
		logger.log(`Electron Process closed. Exited with code ${code}`);
		// Server shouldn't shut down on exit because electron restart closes down electron and restarts in the background.
		// process.exit();
	});

	process.on('exit', () => {
		// Server shouldn't shut down on exit because electron restart closes down electron and restarts in the background.
		// electronProcess.kill();
		killElectronProcesses();
	});
	cb();
};
