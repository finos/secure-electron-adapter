

/**
 * This file handles install events. Anything that should happen before our application runs should go here. Shortcuts, registry, download of assets, etc.
 */
const logger = require('../../src/logger/')();
const ChildProcess = require('child_process');
const path = require('path');
const dialog = require('electron').dialog;

function handleSquirrelEvent(app) {
	// If we don't have an install event then we're just running the application
	if (process.argv.length === 1) {
		return false;
	}
	const appFolder = path.resolve(process.execPath, '..');
	const rootAtomFolder = path.resolve(appFolder, '..');
	const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
	const exeName = path.basename(process.execPath);
	logger.debug(`Update exe path: ${exeName}`);
	/**
	 *  Here we either spawn the application or the electron updater
	 * @param {*} command  - The application to spawn
	 * @param {*} args  - the command line arguments
	 */
	const spawn = function (command, args) {
		let spawnedProcess;
		try {
			spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
		} catch (error) {
			dialog.showErrorBox('Error in setupEvents/spawn', `${error.message || error}`);
		}

		return spawnedProcess;
	};

	/**
	 * This will run the electron updater
	 * @param {*} args - Command line arguments meant for the updater
	 */
	const spawnUpdate = function (args) {
		return spawn(updateDotExe, args);
	};

	const squirrelEvent = process.argv[1];
	switch (squirrelEvent) {
	case '--squirrel-firstrun':
		spawnUpdate(['--createShortcut', exeName]);
		return false;
	case '--squirrel-install':
		spawnUpdate(['--createShortcut', exeName]);
		return true;
	case '--squirrel-updated':
		return false;
	case '--squirrel-uninstall':
		// Undo anything you did in the --squirrel-install and
		// --squirrel-updated handlers
		// Remove desktop and start menu shortcuts
		spawnUpdate(['--removeShortcut', exeName]);
		setTimeout(app.quit, 1000);
		return true;

	case '--squirrel-obsolete':
		// This is called on the outgoing version of your app before
		// we update to the new version - it's the opposite of
		// --squirrel-updated.
		app.quit();
		return true;
	}
	return false;
}
module.exports = handleSquirrelEvent;
