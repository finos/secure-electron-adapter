const readOnlyFsProxy = require('./proxiedFs');
// exposes only file read functionality
const allowedModules = new Set(['path']);
const proxiedModules = new Map([['fs', readOnlyFsProxy]]);
const allowedElectronModules = new Set();
const allowedGlobals = new Set(['preload']);
const logger = require('../../../logger/')();
/**
 * FEA turns off node integration in render processes, so require is not usable by default. You can still
 * use it in preloads. All requests using the remote module are caught and tested here for security.
 *
 * @example this will not work because we disallow all modules except fsProxied and path :)
 *
 * const remote = require('electron').remote;
 * const fs = remote.require('fs');
 * fs.write('badbug.exe')
 * const spawn = remote.require('spawn');
 * for(;;) {
 * 	spawn('badbug.exe', { detached: true });
 * }
 */
const setupRemoteModuleSecurity = (app) => {
	/**
	 * @example remote.require(module);
	 */
	app.on('remote-require', (event, webContents, moduleName) => {
		logger.verbose(`remote-require request received: ${moduleName}`);
		if (proxiedModules.has(moduleName)) {
			logger.verbose(`${moduleName} requested. Providing a proxied version of fs module for security purposes.`);
			event.returnValue = proxiedModules.get(moduleName);
		} else if (!allowedModules.has(moduleName)) {
			logger.error(`${moduleName} is not in the list of allowed modules. Blocking this for security purposes.`);
			event.returnValue = null; // event.preventDefault() will break the caller. Just return null.
		}
	});

	/**
	 * @example remote.require(electronModule);
	 */
	app.on('remote-get-builtin', (event, webContents, moduleName) => {
		logger.verbose(`remote-get-builtin request received: ${moduleName}`);
		if (!allowedElectronModules.has(moduleName)) {
			logger.error(`${moduleName} is not in the list of allowed modules. Blocking this for security purposes.`);
			event.returnValue = null; // event.preventDefault() will break the caller. Just return null.
		}
	});

	/**
	 * @example remote.getGlobal(electronModule);
	 */
	app.on('remote-get-global', (event, webContents, globalName) => {
		logger.verbose(`remote-get-global request received: ${globalName}`);
		if (!allowedGlobals.has(globalName)) {
			logger.error(`${globalName} is not in the list of allowed globals. Blocking this for security purposes.`);
			event.returnValue = null; // event.preventDefault() will break the caller. Just return null.
		}
	});

	/**
	 * Allow the remote to getCurrentWindow.
	 *
	 * @example remote.getCurrentWindow();
	 */
	app.on('remote-get-current-window', (event, webContents) => {
		logger.verbose('remote-get-current-window request received');
	});

	/**
	 * @example remote.getCurrentWebContents();
	 */
	app.on('remote-get-current-web-contents', (event, webContents) => {
		logger.verbose('remote-get-current-web-contents request received');
		event.returnValue = null; // event.preventDefault() will break the caller. Just return null.
	});

	/**
	 * @example remote.getGuestWebContents();
	 */
	app.on('remote-get-guest-web-contents', (event, webContents, guestWebContents) => {
		logger.verbose('remote-get-guest-web-contents request received');
		event.returnValue = null; // event.preventDefault() will break the caller. Just return null.
	});
};

module.exports = setupRemoteModuleSecurity;
