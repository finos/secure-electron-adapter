const EventEmitter = require('events').EventEmitter;
const download = require('../common/download');
const fs = require('fs');
const electron = require('electron');
const os = require('os');
const si = require('systeminformation');
const appData = require('./helpers/getAppDataFolderSync')();
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
const ApplicationManager = require('./ApplicationManager');
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
		this.trayIconByApplication = {};
		this.tray;
		this.MonitorInfo = require('./MonitorInfo');// app must be ready before we call this
		this.bind();
		this.setupListeners();
		logger.log('APPLICATION LIFECYCLE: Creating MainSystem');
		// Close down if all of our windows are closed
		this.app.on('window-all-closed', () => {
			logger.log('APPLICATION LIFECYCLE: All windows closed.');
			if (this.restarting) {
				logger.log('APPLICATION LIFECYCLE: Restarting FEA.');
				return;
			}
			this.quit();
		});
	}

	bind() {
		this.quit = this.quit.bind(this);
		this.getVersion = this.getVersion.bind(this);
		this.openUrlWithBrowser = this.openUrlWithBrowser.bind(this);
		this.getHostSpecs = this.getHostSpecs.bind(this);
		this.getMonitorInfo = this.getMonitorInfo.bind(this);
		this.flushStorage = this.flushStorage.bind(this);
		this.getMousePosition = this.getMousePosition.bind(this);
		this.launchExternalProcess = this.launchExternalProcess.bind(this);
		this.restartApplication = this.restartApplication.bind(this);
		this.getProcessList = this.getProcessList.bind(this);
		this.notification = this.notification.bind(this);
		this.setTrayIcon = this.setTrayIcon.bind(this);
		this.getTrayIconInfo = this.getTrayIconInfo.bind(this);
		this.removeTrayIcon = this.removeTrayIcon.bind(this);
	}

	/**
	 * These listeners receive calls from the client side api
	 */
	setupListeners() {
		PermissionsManager.addRestrictedListener('clearCache', this.clearCache, 'System.clearCache');
		PermissionsManager.addRestrictedListener('quit', this.quit, 'System.exit');
		PermissionsManager.addRestrictedListener('getVersion', this.getVersion, 'System.getVersion');
		PermissionsManager.addRestrictedListener('openUrlWithBrowser', this.openUrlWithBrowser, 'System.openUrlWithBrowser');
		PermissionsManager.addRestrictedListener('getHostSpecs', this.getHostSpecs, 'System.getHostSpecs');
		PermissionsManager.addRestrictedListener('getMonitorInfo', this.getMonitorInfo, 'System.getMonitorInfo');
		PermissionsManager.addRestrictedListener('flushStorage', this.flushStorage, 'System.flushStorage');
		PermissionsManager.addRestrictedListener('getMousePosition', this.getMousePosition, 'System.getMousePosition');
		PermissionsManager.addRestrictedListener('launchExternalProcess', this.launchExternalProcess, 'System.launchExternalProcess');
		PermissionsManager.addRestrictedListener('restartApplication', this.restartApplication, 'Application.restartApplication');
		PermissionsManager.addRestrictedListener('getProcessList', this.getProcessList, 'System.getProcessList');
		PermissionsManager.addRestrictedListener('notification', this.notification, 'Notification.notification');
		PermissionsManager.addRestrictedListener('setTrayIcon', this.setTrayIcon, 'Application.setTrayIcon');
		PermissionsManager.addRestrictedListener('getTrayIconInfo', this.getTrayIconInfo, 'Application.getTrayIconInfo');
		PermissionsManager.addRestrictedListener('removeTrayIcon', this.removeTrayIcon, 'Application.removeTrayIcon');
		PermissionsManager.addRestrictedListener('getRuntimeInfo', this.getRuntimeInfo, 'System.getRuntimeInfo');
		MainBus.addListener('checkPermission', this.checkPermission); // This listener can not be disabled as other permission checking is dependent on it.
	}

	/**
	 * Handle application quit here
	 */
	quit() {
		this.closeExternalApps();
		logger.log('APPLICATION LIFECYCLE: Quitting application');
		this.app.quit();
	}

	/**
	 * Clears the cache
	 *
	 * Example usage: https://github.com/ChartIQ/finsemble/blob/2b8e0895136f6c5c53cc89d71a582bf4eb74a799/src/clients/windowClient.ts#L809
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
		const currentWindow = await ApplicationManager.findWindowById(2);

		if (!currentWindow) {
			logger.warn('clearCache failed because currentWindow is not found.');
			return;
		}

		// https://github.com/electron/electron/blob/master/docs/api/session.md#sesclearstoragedataoptions-callback
		currentWindow.win.webContents.session.clearStorageData({ storages });
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
	 * Open a url in the default browser
	 * @param {BusEvent} eventObj
	 */
	openUrlWithBrowser(eventObj) {
		function validURl(s) {
			const regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
			return regexp.test(s.toLowerCase());
		}

		if (validURl(eventObj.data)) {
			shell.openExternal(eventObj.data);
		} else {
			logger.warn(`Failed to open browser - invalid url provided" ${eventObj.data}`);
		}

		eventObj.respond();
	}

	/**
	 * Get the current system specs
	 * @param {BusEvent} eventObj
	 */
	getHostSpecs(eventObj) {
		si.graphics((graphicsInfo) => {
			eventObj.respond({
				aeroGlassEnabled: false,
				arch: os.arch(),
				cpus: os.cpus(),
				gpu: graphicsInfo,
				memory: os.totalmem(),
				name: os.type(),
				screenSaver: false,
			});
		});
	}

	/**
 	 * Get all of the monitor information
 	 * @param {BusEvent} eventObj
 	 */
	getMonitorInfo(eventObj) {
		this.MonitorInfo.getMonitorInfo((monitorInfo) => {
			const response = { monitorInfo };
			eventObj.respond(response);
		});
	}

	/**
 	 * Flush local storage. Local storage takes a long time to flush on its own so you can force it.
 	 * @param {BusEvent} eventObj
 	 */
	async flushStorage(eventObj) {
		// This id is arbitrary. It goes back to the dalal and sharp era.
		const currentWindow = await ApplicationManager.findWindowById(2);

		if (!currentWindow) {
			logger.warn('flushStorage failed.');
			return;
		}
		currentWindow.win.webContents.session.flushStorageData();
		logger.debug('Successfully flushed storage');
	}

	/**
 	 * Get the current mouse position. We add left/top since OpenFin gives that
 	 * @param {BusEvent} eventObj
 	 */
	getMousePosition(eventObj) {
		const mousePos = electron.screen.getCursorScreenPoint();
		mousePos.left = mousePos.x;
		mousePos.top = mousePos.y;
		eventObj.respond(mousePos);
	}

	/**
     * This will launch an external(non electron) application
     * @param {EventObj} eventObj
     */
	async launchExternalProcess(eventObj) {
		const arg = eventObj.data;
		// @todo make a helper that safely strignifies objects....lodash?
		logger.debug('MainSystem->launchExternalProcess');
		// Whether to remove path in these calls is config driven. By default we don't allow users to specify a path. An app must have a manifest for it to work.
		// If a firm wants to allow paths in calls to launchExternalProcess, we allow them.
		let removePathInSpawnExternalApps = this.app.manifest.removePathInSpawnExternalApps;

		if (typeof (removePathInSpawnExternalApps) === 'undefined') removePathInSpawnExternalApps = true;

		// On the render side, anyone who tries to invoke launchExternalProcess with a path parameter should be met with a swift error.
		// If we try to invoke this method from within the main process somehow, verify that it's not using invalid parameters.
		if (removePathInSpawnExternalApps && arg && arg.data && arg.data.path) {
			const err = {
				status: 'error',
				code: 'unsupported_argument',
				message: "For security reasons, spawning by path is disallowed by default. If you would like to allow spawning by path, open your application's manifest and set 'removePathInSpawnExternalApps' to true. This is a top-level property on the manifest. If you have separate manifests, make sure to change the property in each file."
			};
			logger.warn(err.message);
			return eventObj.respond(err);
		}

		// Attempt to launch external process, catch any errors and respond
		const spawnFileParams = arg.data;
		try {
			await this.app.externalApplicationManager.spawnFile(spawnFileParams);
		} catch (err) {
			logger.error(`Failed to launch external process ${err.message}`);
			return eventObj.respond({
				status: 'error',
				message: err.message,
				code: 'launch_fail',
				error: err
			});
		}
		eventObj.respond({ status: 'success' });
	}

	/**
 	 * Restart application
	* // @todo This needs to be updated. There was an issue with parent applications so that is why it is not on the application level. It should be though.
 	 */
	restartApplication() {
		logger.log('APPLICATION LIFECYCLE: Restarting the application');
		this.restarting = true;
		// ApplicationManager.restartApplication(arg.uuid, this.app);
		ApplicationManager.closeAllApplications();
		this.closeExternalApps();
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
		if (!ApplicationManager.pollingStarted) {
			await ApplicationManager.startPollingResources();
		}
		if (this.pollingTimeout) {
			clearTimeout(this.pollingTimeout);
		}
		this.pollingTimeout = setTimeout(ApplicationManager.stopPollingResources.bind(this), 2000);
		const applications = Object.values(ApplicationManager.applications);
		const rawProcessList = applications.map(app => app.getHeuristics());
		const processList = rawProcessList.filter(p => Boolean(p));
		eventObj.respond(processList);
	}

	// TODO: Openfin allows a tray icon per application. However, for notifications here we are using the tray icon so need at least one global tray icon.
	// Fix this so that the first one is global and we also have a list of icons by application.
	// Also, we do not need to adhere to openfin's tray icon limitations. Need discussion on what our solution should be.
	// Maybe this will not be an issue if we have working regular notifications and do not need to rely on the tray.
	/**
	 *
	 * @param {BusEvent} eventObj
	 */
	notification(eventObj) {
		const notificationSettings = {
			title: eventObj.data.title || 'Finsemble',
			message: eventObj.data.message || eventObj.data.body || eventObj.data.content || 'Finsemble',
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

	// TODO: Openfin allows a tray icon per application. However, for notifications here we are using the tray icon so need at least one global tray icon.
	// Fix this so that the first one is global and we also have a list of icons by application.
	// Also, we do not need to adhere to openfin's tray icon limitations. Need discussion on what our solution should be.
	// Maybe this will not be an issue if we have working regular notifications and do not need to rely on the tray.
	/**
 	 *
 	 * @param {BusEvent} eventObj
 	 */
	async setTrayIcon(eventObj) {
		const currentFolderLocation = path.join(appData, 'e2o', 'icons');
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
		const trayIcon = new Tray(iconImage);
		if (!this.tray) {
			this.tray = trayIcon;
			this.notificationIcon = filePath;
		}

		this.trayIconByApplication[eventObj.data.uuid] = trayIcon;

		// @todo make this look nicer.
		if (eventObj.data.listeners) {
			if (eventObj.data.listeners.includes('clickListener')) {
				trayIcon.addListener('click', (event, position) => {
					logger.verbose('User left-clicked the system tray icon');
					position.event = 'click';
					position.left = position.x;
					position.right = position.y;
					position.bounds = { ...position };
					position.button = 0;
					eventObj.respond(position);
				});

				trayIcon.addListener('right-click', (event, position) => {
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
				trayIcon.addListener('mouse-enter', (event, position) => {
					eventObj.respond(position);
				});
			}
		}
	}

	/**
 	 *
 	 * @param {BusEvent} eventObj
 	 */
	getTrayIconInfo(eventObj) {
		const trayIcon = this.trayIconByApplication[eventObj.data.uuid];
		if (trayIcon) {
			const iconBounds = trayIcon.getBounds();
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
	removeTrayIcon(eventObj) {
		const trayIcon = this.trayIconByApplication[eventObj.data.uuid];
		if (trayIcon) {
			if (trayIcon === this.tray) this.tray = null;
			trayIcon.destroy();
			delete this.trayIconByApplication[eventObj.data.uuid];
			logger.info('Tray icon deleted.');
		}
	}

	/**
	 * Responds with a fake Runtime Object
	 * @param {BusEvent} eventObj
	 */
	getRuntimeInfo(eventObj) {
		eventObj.respond({ port: 1234 });
	}

	/**
	 * Responds to checkPermission request from the render process
	 * @param {BusEvent} eventObj
	 * @param {string} permission
	 */
	async checkPermission(eventObj) {
		const mainWin = await ApplicationManager.findWindowByName(eventObj.sender.browserWindowOptions.name);
		eventObj.respond(PermissionsManager.checkPermission(mainWin, eventObj.data));
	}
	/**
	 * Invokes ExternalApplicationManager#closeAllApps
	 */
	closeExternalApps() {
		this.app.externalApplicationManager.closeAllApps();
	}
}
module.exports = MainSystem;
