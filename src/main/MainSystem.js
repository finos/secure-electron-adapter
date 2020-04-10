const EventEmitter = require('events').EventEmitter;
const download = require('../common/download');
const fs = require('fs');
const electron = require('electron');
const process = require('process');
const os = require('os');
const si = require('systeminformation');
const appData = require('./helpers/getAppDataFolderSync').folderPath;
const logger = require('../logger/')();
const { clearPreloadCache } = require('../common/helpers');
const path = require('path');
const mkdirp = require('mkdirp');

const {
	nativeImage,
	Tray,
	shell,
} = electron;
const processListMemCache = {};

/* Tried many different notifiers before I landed here
native solutions:
Notifications API: does not work (at least while developing. needs appID to be the same as an installed application. Will possibly work when installed?)
Tray Balloon: extremely unreliable: the first one or sometimes two notifications work only if instantly fired after created. Then stops working

electron-notify: did not work, no notification shows up
electron-notifications: shows white notification window. this ones uses actual electron windows instead of native
electron-windows-notifications: has dependency issues and is unable to build (however for windows only this looks like a good option to look deeper)
electron-native-notification: does not work
electron-main-notification: does not work
elnotifier: does not work
node-notifier: works but application shows up as "SnoreToast" and the method to change the appID from snoreToast causes no Notifications to show up
*/


const notifier = require('node-notifier');
const MainWindowProcessManager = require('./MainWindowProcessManager');
const MainWindow = require('./MainWindow');
const MainBus = require('./MainBus');
const PermissionsManager = require('../permissions/PermissionsManager');

/**
 * Handle all system events/calls
 */
class MainSystem extends EventEmitter {
	/**
	 *
	 * @param {ElectronApp} app
	 */
	constructor(app) {
		super();
		this.app = app;
		this.trayByWindowProcess = {};
		this.tray;
		this.bind();
		this.setupListeners();
		logger.log('APPLICATION LIFECYCLE: Creating MainSystem');
		// Close down if all of our windows are closed
		this.app.on('window-all-closed', () => {
			logger.log('APPLICATION LIFECYCLE: All windows closed.');
			if (this.restarting) {
				logger.log('APPLICATION LIFECYCLE: Restarting SEA.');
				return;
			}
			this.exit();
		});

		// set timer to notify user if startup app never completes startup handshake.  Timer is cleared when handshake is done (see startupApplicationHandshake below);
		// a 10 second timeout should be more than enough time since the handshake should be the first action the startup application takes
		this.startupApplicationHandshakeTimer = setTimeout(() => {
			// confirm in manifest that should check for handshake from primary application -- note by default the check is disabled
			// note: have to check manifest inside the timer because it's not available in the constructor
			if (this.app.manifest.main.requireHandshake) {
				// because the startup app has been invoked, with more things that can go wrong, so a notification is more appropriate here than a showErrorBox
				const notificationData = {
					data: {
						title: "Electron Adaptor",
						message: `The primary application ${this.app.manifest.main.uuid} never signaled it started successfully. Administrator, please verify manifest.main.url is correct.`,
						wait: true // wait should keep the notification up until user closes, but this doesn't seem to work
					}
				};
				this.notification(notificationData);
			}
		}, 10000);
	}

	bind() {
		this.exit = this.exit.bind(this);
		this.getVersion = this.getVersion.bind(this);
		this.startupApplicationHandshake = this.startupApplicationHandshake.bind(this);
		this.getSystemInfo = this.getSystemInfo.bind(this);
		this.getMonitorInfo = this.getMonitorInfo.bind(this);
		this.flushStorage = this.flushStorage.bind(this);
		this.getMousePosition = this.getMousePosition.bind(this);
		this.restartWindowProcess = this.restartWindowProcess.bind(this);
		this.getProcessList = this.getProcessList.bind(this);
		this.notification = this.notification.bind(this);
		this.setTray = this.setTray.bind(this);
		this.getTrayInfo = this.getTrayInfo.bind(this);
		this.removeTray = this.removeTray.bind(this);
		this.restartAndInstallUpdate = this.restartAndInstallUpdate.bind(this);
		this.getEnvironmentVariable = this.getEnvironmentVariable.bind(this);
	}

	/**
	 * These listeners receive calls from the client side api
	 */
	setupListeners() {
		PermissionsManager.addRestrictedListener('clearCache', this.clearCache, 'System.clearCache');
		PermissionsManager.addRestrictedListener('exit', this.exit, 'System.exit');
		PermissionsManager.addRestrictedListener('getVersion', this.getVersion, 'System.getVersion');
		PermissionsManager.addRestrictedListener('startupApplicationHandshake', this.startupApplicationHandshake, 'System.startupApplicationHandshake');
		PermissionsManager.addRestrictedListener('getSystemInfo', this.getSystemInfo, 'System.getSystemInfo');
		PermissionsManager.addRestrictedListener('getMonitorInfo', this.getMonitorInfo, 'System.getMonitorInfo');
		PermissionsManager.addRestrictedListener('flushStorage', this.flushStorage, 'System.flushStorage');
		PermissionsManager.addRestrictedListener('getMousePosition', this.getMousePosition, 'System.getMousePosition');
		PermissionsManager.addRestrictedListener('restartWindowProcess', this.restartWindowProcess, 'WindowProcess.restartWindowProcess');
		PermissionsManager.addRestrictedListener('getProcessList', this.getProcessList, 'System.getProcessList');
		PermissionsManager.addRestrictedListener('notification', this.notification, 'Notification.notification');
		PermissionsManager.addRestrictedListener('setTray', this.setTray, 'WindowProcess.setTray');
		PermissionsManager.addRestrictedListener('getTrayInfo', this.getTrayInfo, 'WindowProcess.getTrayInfo');
		PermissionsManager.addRestrictedListener('removeTray', this.removeTray, 'WindowProcess.removeTray');
		PermissionsManager.addRestrictedListener('getEnvironmentVariable', this.getEnvironmentVariable, 'System.getEnvironmentVariable');
		MainBus.addListener('checkPermission', this.checkPermission); // This listener can not be disabled as other permission checking is dependent on it.
	}

	/**
	 * Handle application exit here
	 */
	exit() {
		// this.closeExternalApps();

		logger.log('APPLICATION LIFECYCLE: Quitting application');

		// app.exit (as opposed to app.quit) causes Electron to immediately terminate without any "quitting" events
		this.app.exit();
	}

	/**
	 * Clears the cache
	 *
	 * @param {BusEvent} eventObj
	 */
	async clearCache(eventObj) {
		const options = eventObj.data || {
			appcache: true,
			cookies: true,
			localstorage: true,
		};
		const storageKeys = Object.keys(options);
		const truthyKeys = storageKeys.filter(key => options[key] === true);
		const storages = truthyKeys.map(key => key.toLowerCase());

		// This id is arbitrary. It goes back to the dalal and sharp era.
		const currentWindow = await MainWindowProcessManager.findWindowById(2);

		if (!currentWindow) {
			logger.warn('clearCache failed because currentWindow is not found.');
			return;
		}

		// https://github.com/electron/electron/blob/master/docs/api/session.md#sesclearstoragedataoptions-callback
		await currentWindow.win.webContents.session.clearStorageData({ storages });
		logger.info('Electron Cache cleared.');
		if (options.preload) {
			clearPreloadCache();
		}
	}

	/**
 	 * This currently returns the electron version
 	 * @param {BusEvent} eventObj
 	 */
	getVersion(eventObj) {
		eventObj.respond(this.app.getVersion());
	}

	/**
	 * Can be used once by the application to indicate startup successfully completed. This function clears the handshake timer.
	 */
	startupApplicationHandshake() {
		if (this.startupApplicationHandshakeTimer) {
			clearTimeout(this.startupApplicationHandshakeTimer);
			this.startupApplicationHandshakeTimer = null;
		}
	}

	/**
	 * Get the current system specs
	 * @param {BusEvent} eventObj
	 */
	getSystemInfo(eventObj) {
		si.graphics((graphicsInfo) => {
			eventObj.respond({
				arch: os.arch(),
				cpus: os.cpus(),
				gpu: graphicsInfo,
				memory: os.totalmem(),
				osType: os.type(),
				osVersion: os.release(),
			});
		});
	}

	/**
 	 * Get all of the monitor information
 	 * @param {BusEvent} eventObj
 	 */
	getMonitorInfo(eventObj) {
		const allDisplays = electron.screen.getAllDisplays();
		const primaryDisplay = electron.screen.getPrimaryDisplay();

		const response = { allDisplays, primaryDisplay};

		eventObj.respond(response);
	}

	/**
 	 * Flush local storage. Local storage takes a long time to flush on its own so you can force it.
 	 * @param {BusEvent} eventObj
 	 */
	async flushStorage(eventObj) {
		// This id is arbitrary. It goes back to the dalal and sharp era.
		const currentWindow = await MainWindowProcessManager.findWindowById(2);

		if (!currentWindow) {
			logger.warn('flushStorage failed.');
			return;
		}
		currentWindow.win.webContents.session.flushStorageData();
		logger.debug('Successfully flushed storage');
	}

	/**
 	 * Get the current mouse position.
 	 * @param {BusEvent} eventObj
 	 */
	getMousePosition(eventObj) {
		const mousePos = electron.screen.getCursorScreenPoint();
		mousePos.left = mousePos.x;
		mousePos.top = mousePos.y;
		eventObj.respond(mousePos);
	}

	/**
	 * Restart the application and apply the updates.
	 * @param {*} quitAndRestart The function from (auto updater)[https://github.com/electron/electron/blob/54ef9068327d7ac34af06ec133b4cb4ea7edbc8f/lib/browser/api/auto-updater/auto-updater-win.js]
	 * to restart the app and install the update after it has been downloaded.
	 */
	restartAndInstallUpdate(quitAndRestart) {
		logger.log('APPLICATION LIFECYCLE: Restarting the application to apply the new updates.');
		this.restarting = true;
		MainWindowProcessManager.closeAllApplications();
		// this.closeExternalApps();
		quitAndRestart();
	}

	/**
 	 * Restart application
	* // @todo This needs to be updated. There was an issue with parent applications so that is why it is not on the application level. It should be though.
 	 */
	restartWindowProcess() {
		logger.log('APPLICATION LIFECYCLE: Restarting the application');
		this.restarting = true;
		MainWindowProcessManager.closeAllApplications();
		// this.closeExternalApps();
		// From the Electron docs: https://electronjs.org/docs/api/app#apprelaunchoptions
		// Relaunches the app when current instance exits. Relaunch will do nothing if the app never exits, so relaunch must be called, then exit which will force the releaunch.
		this.app.relaunch();
		this.app.exit(0);
	}

	/**
 	 * Get all of our electron processes and info for each.
	 * @note the rare method that is self explanatory/
 	 * @param {BusEvent} eventObj
 	 */
	async getProcessList(eventObj) {
		if (!MainWindowProcessManager.pollingStarted) {
			await MainWindowProcessManager.startPollingResources();
		}
		if (this.pollingTimeout) {
			clearTimeout(this.pollingTimeout);
		}
		this.pollingTimeout = setTimeout(MainWindowProcessManager.stopPollingResources.bind(this), 2000);
		const applications = Object.values(MainWindowProcessManager.allWindowProcesses);
		const rawProcessList = applications.map(app => app.getHeuristics());
		const processList = rawProcessList.filter(p => Boolean(p));
		eventObj.respond(processList);
	}

	// TODO: For notifications here we are using the tray icon so need at least one global tray icon.
	// Fix this so that the first one is global and we also have a list of icons by application.
	// Maybe this will not be an issue if we have working regular notifications and do not need to rely on the tray.
	/**
	 *
	 * @param {BusEvent} eventObj
	 */
	notification(eventObj) {
		// Support sending a string or an object in the message field
		if(eventObj.data.message) {
			if (eventObj.data.message.title) eventObj.data.title = eventObj.data.message.title;
			if (eventObj.data.message.description) eventObj.data.message = eventObj.data.message.description;
		}
		const notificationSettings = {
			title: eventObj.data.title || 'Secure Electron Adapter',
			message: eventObj.data.message || eventObj.data.body || eventObj.data.content || 'Secure Electron Adapter',
			// wait: false,
			icon: eventObj.data.icon || this.notificationIcon,
		};
		logger.debug(`Sending notification: ${notificationSettings.title}`);
		notifier.notify(notificationSettings, (err, res) => {
			if (err) {
				logger.error(`Failed to send notification ${notificationSettings.title} ${err.message || err}`);
			} else {
				logger.debug(`Notification sent. ${res}`);
			}
		});
	}

	// TODO: For notifications here we are using the tray icon so need at least one global tray icon.
	// Fix this so that the first one is global and we also have a list of icons by application.
	// Maybe this will not be an issue if we have working regular notifications and do not need to rely on the tray.
	/**
 	 *
 	 * @param {BusEvent} eventObj
 	 */
	async setTray(eventObj) {
		const currentFolderLocation = path.join(appData, 'sea', 'icons');
		if (!fs.existsSync(currentFolderLocation)) {
			logger.debug('Creating icon folder', currentFolderLocation);
			mkdirp.sync(currentFolderLocation);
		}
		const filePath = path.join(currentFolderLocation, Buffer.from(eventObj.data.iconpath).toString('base64'));
		try {
			const data = await download(eventObj.data.iconpath);
			fs.writeFileSync(filePath, data);
		} catch (err) {
			logger.warn(`Failed to download icon from ${eventObj.data.iconpath}: ${err.message}`);
		}

		let iconImage = nativeImage.createFromPath(filePath); // TODO: icon is blank even though the file exists
		iconImage = iconImage.resize({ width: 16, height: 16 }); // this was supposed to be the solution to a blank icon but it doesnt work.
		const tray = new Tray(iconImage);
		if (!this.tray) {
			this.tray = tray;
			this.notificationIcon = filePath;
		}

		this.trayByWindowProcess[eventObj.data.uuid] = tray;

		// @todo make this look nicer.
		if (eventObj.data.listeners) {
			if (eventObj.data.listeners.includes('clickListener')) {
				tray.addListener('click', (event, position) => {
					logger.verbose('User left-clicked the system tray icon');
					position.event = 'click';
					position.left = position.x;
					position.right = position.y;
					position.bounds = { ...position };
					position.button = 0;
					eventObj.respond(position);
				});

				tray.addListener('right-click', (event, position) => {
					logger.verbose('User right-clicked the system tray icon');
					position.event = 'click';
					position.left = position.x;
					position.right = position.y;
					position.bounds = { ...position };
					position.button = 2;
					eventObj.respond(position);
				});
			}

			// looks like this is mac only
			// @todo figure out what this does when we support OSX.
			if (eventObj.data.listeners.includes('hoverListener')) {
				tray.addListener('mouse-enter', (event, position) => {
					eventObj.respond(position);
				});
			}
		}
	}

	/**
 	 *
 	 * @param {BusEvent} eventObj
 	 */
	getTrayInfo(eventObj) {
		const tray = this.trayByWindowProcess[eventObj.data.uuid];
		if (tray) {
			const iconBounds = tray.getBounds();
			iconBounds.left = iconBounds.x;
			iconBounds.top = iconBounds.y;
			logger.verbose('Sending tray icon info', iconBounds);
			eventObj.respond(iconBounds);
		}
	}

	/**
 	 *
 	 * @param {BusEvent} eventObj
 	 */
	removeTray(eventObj) {
		const tray = this.trayByWindowProcess[eventObj.data.uuid];
		if (tray) {
			if (tray === this.tray) this.tray = null;
			tray.destroy();
			delete this.trayByWindowProcess[eventObj.data.uuid];
			logger.info('Tray icon deleted.');
		}
	}

	/**
	 * Responds to getEnvironmentVariable request from the render process
	 * @param {*} eventObj -- needs to have a "data.variableName" property, which is either a string or an array of strings
	 */
	getEnvironmentVariable(eventObj) {
		const variableName = eventObj.data.variableName;
		const argumentIsValid = typeof (variableName) == "string" || Array.isArray(variableName);
		const environmentVariablesExist = Boolean(process.env);

		if (argumentIsValid && environmentVariablesExist) {
			let value;
			if (Array.isArray(variableName)) {
				value = {};
				variableName.forEach(name => value[name] = process.env[name] || null);
			} else {
				value = process.env[variableName] || null;
			}
			eventObj.respond({ status: "success", value });
		}
		// it is not an error if any given variable does not exists, but it is an error if:
		// 1. we cannot access environment variables
		// 2. eventObj.data.variableName is not a string or an array
		else {
			eventObj.respond({ status: "error", message: "Error processing environment variable message" });
		}
	}

	/**
	 * Responds to checkPermission request from the render process
	 * @param {BusEvent} eventObj
	 * @param {string} permission
	 */
	async checkPermission(eventObj) {
		const mainWin = await MainWindowProcessManager.findWindowByName(eventObj.sender.browserWindowOptions.name);
		eventObj.respond(PermissionsManager.checkPermission(mainWin, eventObj.data));
	}
}
module.exports = MainSystem;
