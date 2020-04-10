const EventEmitter = require('events').EventEmitter;
const MainWindowProcess = require('./MainWindowProcess');
const MainBus = require('./MainBus');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const { getFolderLocation } = require('../common/helpers');
const logger = require('../logger')();
const { nativeImage, BrowserWindow } = require('electron');
const PermissionsManager = require('../permissions/PermissionsManager');
const downloadCache = require('../common/downloadCache');

/**
 * This class manages all windowProcesses. Some system calls are caught here.
 */
class MainWindowProcessManager extends EventEmitter {
	constructor() {
		super();
		this.allWindowProcesses = {};
		this.bind();
		this.setupListeners();
		this.creatingApp = null;
	}

	/**
	 * bind all functions to this
	 *
	 * @return undefined
	 */
	bind() {
		this.setupListeners = this.setupListeners.bind(this);
		this.getAllWindowsRequest = this.getAllWindowsRequest.bind(this);
		this.getAllWindowProcessesRequest = this.getAllWindowProcessesRequest.bind(this);
		this.getWindowInfoSync = this.getWindowInfoSync.bind(this);
		this.getAppInfoSync = this.getAppInfoSync.bind(this);
		this.getWindowProcessForWindow = this.getWindowProcessForWindow.bind(this);
		this.createWindowProcessRequest = this.createWindowProcessRequest.bind(this);
		this.createWindowProcess = this.createWindowProcess.bind(this);
		this.getWindowProcess = this.getWindowProcess.bind(this);
		this.getWindows = this.getWindows.bind(this);
		this.closeAllWindowProcesses = this.closeAllWindowProcesses.bind(this);
		this.spawnWithAffinityRequest = this.spawnWithAffinityRequest.bind(this);
		this.hideSplashScreen = this.hideSplashScreen.bind(this);
		this.hideSplashScreenFromBus = this.hideSplashScreenFromBus.bind(this);
		this.showSplashScreen = this.showSplashScreen.bind(this);
		this.showSplashScreenFromBus = this.showSplashScreenFromBus.bind(this);
		this.startPollingResources = this.startPollingResources.bind(this);
		this.stopPollingResources = this.stopPollingResources.bind(this);
		this.startPollingCheck = this.startPollingCheck.bind(this);
		this.getManifest = this.getManifest.bind(this);
		this.setManifest = this.setManifest.bind(this);
		this.runPreloads = this.runPreloads.bind(this);
	}

	/**
	 * all of the events the manager listens for
	 *
	 * @return undefined
	 */
	// add permission string to unimplemented listeners and make sure they are in defaultwindowoptions
	setupListeners() {
		PermissionsManager.addRestrictedListener('getAllWindows', this.getAllWindowsRequest, 'System.getAllWindows');
		PermissionsManager.addRestrictedListener('getWindowProcessList', this.getAllWindowProcessesRequest, 'System.getWindowProcessList');
		PermissionsManager.addRestrictedListener('syncWindowInfo', this.getWindowInfoSync, 'Window.syncWindowInfo');
		PermissionsManager.addRestrictedListener('syncAppInfo', this.getAppInfoSync, 'WindowProcess.syncAppInfo');
		PermissionsManager.addRestrictedListener('getWindowProcessForWindow', this.getWindowProcessForWindow); // nothing sends this event
		PermissionsManager.addRestrictedListener('createWindowProcess', this.createWindowProcessRequest, 'WindowProcess.createWindowProcess');
		PermissionsManager.addRestrictedListener('createWindowWithAffinity', this.spawnWithAffinityRequest, 'Window.createWindowWithAffinity');
		PermissionsManager.addRestrictedListener('getWindowProcess', this.getWindowProcess); // nothing sends this event
		PermissionsManager.addRestrictedListener('getWindows', this.getWindows, 'WindowProcess.getWindows');
		PermissionsManager.addRestrictedListener('startPollingCheck', this.startPollingCheck); // internal only
		MainBus.addListener('hideSplashScreen', this.hideSplashScreenFromBus);
		MainBus.addListener('showSplashScreen', this.showSplashScreenFromBus);
		MainBus.addListener('runPreloads', this.runPreloads);
	}

	/**
	 * @private
	 * Helper function to get the list of windowProcesses safely
	 * Makes sure there is no pending windowProcess creation before returning list
	 */
	async getWindowProcessList() {
		// waits for a pending promise from app creation
		try {
			await this.creatingApp;
			return this.allWindowProcesses;
		} catch (err) {
			logger.error(`Failed to create windowProcess: ${err}`);
		}
	}

	getManifest() {
		return this.manifest;
	}

	setManifest(manifest) {
		this.manifest = manifest;
	}

	/**
	 * Create a new windowProcess request.
	 *
	 * @param {BusEvent} eventObj
	 */
	async createWindowProcessRequest(eventObj) {
		const args = eventObj.data;
		let isMain = false;
		let parentUUID = null;
		const windowCreatingWindowProcess = await this.findWindowById(eventObj.respond.id);
		if (windowCreatingWindowProcess) {
			isMain = false;	// TODO: consider removing this line
			const app = await this.getWindowProcessByUUID(windowCreatingWindowProcess.appUUID);
			parentUUID = app.uuid;
		}
		const newApp = await this.createWindowProcess(args, isMain, parentUUID);
		const response = {
			windowProcessUUID: newApp.uuid,
			name: newApp.name
		};
		eventObj.respond(response);
	}

	/**
	 * create an electron nativeImage using the provided imageURL. Return the nativeImage and the filepath
	 *
	 * @param {String} imageURL
	 * @return {Object}
	 * @return {String} Object.filePath
	 * @return {NativeImage} Object.splashScreenImage
	 */
	async loadSplashScreen(imageURL) {
		const currentFolderLocation = await getFolderLocation('cache');
		if (!fs.existsSync(currentFolderLocation)) {
			mkdirp.sync(currentFolderLocation);
		}

		const imageExt = imageURL.substr(imageURL.lastIndexOf('.') + 1);

		// Turn the url of the splash image into a filename hash
		const imageNameHash = `${Buffer.from(imageURL).toString('base64')}.${imageExt}`;
		const filePath = path.join(currentFolderLocation, imageNameHash);

		logger.debug(`Looking for splash screen in ${filePath}`);

		if (!fs.existsSync(filePath)) {
			// @todo, use caching directives here
			logger.debug(`Loading splash screen: ${imageURL}`);
			try {
				await downloadCache({
					toPath: currentFolderLocation,
					fileName: imageNameHash,
					fromPath: imageURL,
				});
			} catch (err) {
				const error = new Error(err);
				logger.debug(`Failed to get cache for splash screen ${err.message}`);
				throw (error);
			}
		} else {
			logger.debug('Found cached splash screen');
		}
		const splashScreenImage = nativeImage.createFromPath(filePath);
		return {
			splashScreenImage,
			filePath,
		};
	}

	/**
	 * show the splash screen from a bus event
	 * @param {BusEvent} eventObj
	 */
	async showSplashScreenFromBus(eventObj) {
		const { imageURL, timeout } = eventObj.data;
		try {
			await this.showSplashScreen(imageURL, timeout);
			return eventObj.respond({
				success: true,
			});
		} catch (error) {
			logger.error(`Show splace screen from bus error: ${error.message}`);
			return eventObj.respond({
				error,
			});
		}
	}

	/**
	 * Show a splash screen using the provided imageURL for the specified timeout or until hideSplashScreen is called
	 *
	 * @param {String} imageURL location to download image
	 * @param {Number} (ms) amount of time to show splash screen
	 * @return {Object} can contain an error
	 */
	async showSplashScreen(imageURL, timeoutArg) {
		if (typeof imageURL !== 'string') {
			throw new Error(`provided URL for splash screen must be a string: ${imageURL}`);
		}

		try {
			// check to see if URL is valid
			const url = new URL(imageURL);
		} catch (error) {
			throw new Error(`provided url for splash screen is not valid: ${imageURL}`);
		}

		// default to a 6 second timeout if one is not specified
		const timeout = typeof timeoutArg === 'number' ? timeoutArg : 6000;
		try {
			const { splashScreenImage, filePath } = await this.loadSplashScreen(imageURL);
			const nativeImageSize = splashScreenImage.getSize();
			logger.debug('Displaying splash screen');
			this.splashScreenWindow = new BrowserWindow({
				width: nativeImageSize.width,
				height: nativeImageSize.height,
				frame: false,
				resizable: false,
				transparent: true,
				alwaysOnTop: true,
				skipTaskbar: true
			});

			this.splashScreenWindow.loadFile(filePath);

			if (typeof timeout === 'number') {
				setTimeout(() => {
					this.hideSplashScreen();
				}, timeout);
			}
		} catch (err) {
			logger.error(`Unable to load splash screen ${err.message}`);
			const error = new Error('Error loading splash screen.');
			throw (error);
		}
	}

	/**
	 * hideSplashScreenFromBus closes the current splash screen if it is not already closed.
	 *
	 * @param {BusEvent} eventObj
	 */
	async hideSplashScreenFromBus(eventObj) {
		if (!this.splashScreenWindow) {
			return eventObj.respond({ success: true });
		}
		try {
			this.hideSplashScreen();
			return eventObj.respond({ success: true });
		} catch (error) {
			return eventObj.respond({ error });
		}
	}

	/**
	 * runPreloads runs preloads on the window
	 * @param {BusEvent} eventObj
	 */
	async runPreloads(eventObj) {
		console.log('running preloads')
		const browserWin = eventObj.getBrowserWindow();
		const contents = eventObj.sender;
		let mainWin = await this.findWindowById(browserWin.id);
		if(mainWin.preloadsRun) {
			logger.error(`Attempting to rerun preloads for ${mainWin.name}`);
			return;
		}
		mainWin.preloadsRun = true;
		for(const preload of mainWin.preloadList) {
			try{
				console.log(`running preload ${preload}`);
				const content = fs.readFileSync(preload, { encoding: 'utf8' });
				await contents.executeJavaScript(content)
			} catch(err) {
				console.log('Error in preloads');
				logger.error(`Error in preload ${preload}: ${err.message}`);
			}
		}
		console.log('finished running preloads')
		eventObj.sender.send("runPreloads-complete");
	}

	/**
	 * hideSplashScreen closes the current splash screen if it is not already closed.
	 */
	async hideSplashScreen() {
		try {
			if (!this.splashScreenWindow) return;
			this.splashScreenWindow.close();
			this.splashScreenWindow = null;
		} catch (err) {
			logger.error(`Unable to hide splash screen ${err.message}`);
			const error = new Error('Error hiding splash screen.');
			throw (error);
		}
	}

	/**
	 * create or get windowProcess with affinity and then create requested window
	 *
	 * @param {BusEvent} eventObj
	 */
	async spawnWithAffinityRequest(eventObj) {
		const args = eventObj.data;
		
		if (args.windowType && args.windowType.toLowerCase().includes('application')) delete args.affinity;
		const app = await this.getWindowProcessByAffinity(args.affinity);
		// if this windowProcess already exists
		if (app) {
			return app.createWindow(args, (err, createdWindow) => {
				const response = { windowProcessUUID: app.uuid, windowName: createdWindow.windowName };
				eventObj.respond(response);
			});
		}
		// We need to create a new windowProcess
		const newApp = await this.createWindowProcess(args, false, (err, res) => {
			if (err) logger.error(`spawnWithAffinityRequest -> failed to create new app: ${err}`);
			logger.info(`New app created by spawnWithAffinityRequest: ${res}`);
		});
		const response = { windowProcessUUID: newApp.uuid, windowName: newApp.appWindow.windowName };
		eventObj.respond(response);
	}

	/**
	 * Internal create windowProcess call. If `isMain` is present it must be the manifest.
	 * @param {MainWindowProcessParams} params - The normal window information.
	 * @param {boolean} isMain - If not false, this must be the manifest.
	 * @param {UUID} parentUUID - The windowProcess that is making the requst.
	 * @param {Function} cb
	 * @return {MainWindowProcess}
	 */
	async createWindowProcess(params, isMain, parentUUID, cb = Function.prototype) {
		let app;
		// If a window is specified to have windowType 'application', it should be isolated.
		if (params.windowType && params.windowType.toLowerCase().includes('application')) delete params.affinity;
		if (params.affinity) {
			params.appUUID = params.affinity;
			app = await this.getWindowProcessByAffinity(params.affinity);
		}

		// Get the permission set for the WindowProcess
		params.permissions = PermissionsManager.reconcilePermissions(PermissionsManager.systemPermissions, params.permissions);
		// Pull the trustedPreloads and domain SEA is running in from the manifest. Both values are used to determine which preloads can be loaded
		params.trustedPreloads = this.manifest.electronAdapter.trustedPreloads;

		const startupAppUrl = this.manifest.main.url;
		try {
			params.trustedDomain = new URL(startupAppUrl).hostname;
		} catch (err) {
			logger.error(`${startupAppUrl} is not valid url`);
			params.trustedDomain = null;
		}

		if (!app) app = new MainWindowProcess(params);
		try {
			// save the unresolved promise in a variable so we can wait until the app is done being created before performing dependent actions.
			this.creatingApp = app.start(params);
			// Add the pending promise to process so a separate window request can wait until the app is created.
			process.creatingApp = this.creatingApp;
			await this.creatingApp;
		} catch (err) {
			logger.error(`Failed to create new windowProcess ${err.message}`);
			return cb(err);
		}

		if (isMain) {
			app.manifest = isMain;
			app.isMain = true;
		}
		app.parentUUID = parentUUID;
		this.allWindowProcesses[app.uuid] = app;
		app.addListener('close', this.applicationClosed.bind(this, app.uuid));
		cb(null, app);
		return app;
	}

	/**
	 * This allows us to get information about a windowProcess outside of that windowProcess.
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getWindowProcess(eventObj) {
		const currentApp = await this.getWindowProcessByUUID(eventObj.data.uuid);
		const response = { windowProcessUUID: currentApp.uuid, name: currentApp.name };
		eventObj.respond(response);
	}

	/**
	 * This is fired when a windowProcess is closed. The event is sent to all windows.
	 * @param {UUID} appUUID
	 */
	async applicationClosed(appUUID) {
		const applicationList = await this.getWindowProcessList();
		MainBus.sendEvent(`windowProcessEvent-${appUUID}.closed`, appUUID);
		if (applicationList[appUUID] && applicationList[appUUID].isMain) {
			delete this.allWindowProcesses[appUUID];
			this.closeAllWindowProcesses();
		} else {
			delete this.allWindowProcesses[appUUID];
		}
	}

	/**
	 * A helper to get a windowProcess by it's uuid
	 * @param {UUID} uuid
	 * @return {MainWindowProcess}
	 */
	async getWindowProcessByUUID(uuid) {
		const applicationList = await this.getWindowProcessList();
		return applicationList[uuid];
	}

	/**
	 * send a message to all open applications to start polling for resources
	 *
	 * @returns undefined
	 */
	async startPollingResources() {
		const applicationList = await this.getWindowProcessList();
		logger.log('begin polling');
		this.pollingStarted = true;
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				app.polling = true;
				try {
					await app.appWindow.win.webContents.send('beginPollingResources');
				} catch (e) {
					logger.error(`Failed to send begin polling request for ${app.name}`);
				}
			}
		}
	}

	/**
	 * send a message to all applications to stop polling for resources
	 *
	 * @returns undefined
	 */
	async stopPollingResources() {
		const applicationList = await this.getWindowProcessList();
		logger.log('stopping polling');
		this.pollingStarted = false;
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				app.polling = false;
				try {
					await app.appWindow.win.webContents.send('stopPollingResources');
				} catch (e) {
					logger.debug(`Failed to stop polling request for ${app.name}`);
				}
			}
		}
	}

	/**
	 * @private
	 * Called when new windowProcess launches. If polling has started, send a request for the new windowProcess to begin polling.
	 */
	async startPollingCheck(eventObj) {
		const currentApp = await this.getWindowProcessByUUID(eventObj.data);
		// If polling has started and the current app is not polling send the request
		if (this.pollingStarted == true && !currentApp.polling) {
			this.allWindowProcesses[eventObj.data].polling = true;
			currentApp.appWindow.win.webContents.on('did-finish-load', async () => {
				try {
					await currentApp.appWindow.win.webContents.send('beginPollingResources');
				} catch (e) {
					logger.warn(`Failed to send begin polling request for ${currentApp.name}`);
				}
			});
		}
	}


	/**
	 * A helper to find an window by it's electron id. We need this when a window first comes up.
	 * @param {String} id
	 * @param {Function} cb
	 * @return {MainWindow|null}
	 */
	async findWindowById(id, cb) {
		const applicationList = await this.getWindowProcessList();
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				// check the windowProcess window
				if (app.appWindow && app.appWindow.id === id) {
					return app.appWindow;
				}

				// check the child windows
				let windows;
				if (app.windows) { windows = Object.values(app.windows); }
				for (let j = 0; j < windows.length; j++) {
					const win = windows[j];
					if (win.id === id) {
						return win;
					}
				}
			}
		}
		return null;
	}

	/**
	 * A helper to find a window by it's name
	 * @param {String} name
	 * @param {Function} cb
	 * @return {String|null}
	 */
	async findWindowByName(name, cb) {
		const applicationList = await this.getWindowProcessList();
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				// check the windowProcess window
				if (app.appWindow && app.appWindow.windowName === name) {
					return app.appWindow;
				}

				// check the child windows
				const appWindows = app.windows;
				if (appWindows[name]) {
					return appWindows[name];
				}
			}
		}
		return null;
	}

	/**
	 * Get a windows from UUID and name
	 * @param {String} appUUID
	 * @param {String} name
	 * @return {String|null}
	 */
	async getWindowFromAppAndName(appUUID, name) {
		const applicationList = await this.getWindowProcessList();
		if (!appUUID) {
			logger.error(`appUUID is not defined. Getting window from name ${name}`);
			return this.findWindowByName(name);
		}
		if (!applicationList[appUUID]) {
			logger.info(`no applications with appUUID ${appUUID}`);
			return null;
		}
		if (applicationList[appUUID].windows[name]) {
			return applicationList[appUUID].windows[name];
		}
		if (applicationList[appUUID].appWindow.windowName === name) return applicationList[appUUID].appWindow;
		logger.info(`Cannot get window from windowProcess ${appUUID}, name: ${name}`);
		return null;
	}

	/**
	 * @param {String} affinity
	 * @return {MainWindowProcess}
	 */
	async getWindowProcessByAffinity(affinity) {
		const applicationList = await this.getWindowProcessList();
		const appKeys = Object.keys(applicationList);
		for (let i = 0; i < appKeys.length; i++) {
			const currentApp = applicationList[appKeys[i]];
			if (currentApp.affinity === affinity) {
				return currentApp;
			}
		}
	}

	/**
	 * @todo fix this
	 * Restart a windowProcess. This probably should be in the windowProcess class. We had issues so we just force a full restart if this is called.
	 * @param {UUID} uuid
	 * @param {MainWindowProcess} app
	 * @return {Number}
	 */
	restartWindowProcess(uuid, app) {
		logger.log('Restarting the windowProcess.');
		app.relaunch();
		return app.exit(0);
	}

	/**
	 * Loops through applications and closes them
	 */
	async closeAllWindowProcesses() {
		const windowProcesses = await this.getWindowProcessList();
		for (const a in windowProcesses) {
			const windowProcess = windowProcesses[a];
			windowProcess.close();
		}
	}

	/**
	 * Get a full list of windowProcesses
	 *
	 * @return {MainWindowProcess[]}
	 */
	async getAllWindowProcesses() {
		const windowProcesses = await this.getWindowProcessList();
		const keys = Object.keys(windowProcesses);
		return keys.map((key) => {
			const windowProcess = windowProcesses[key];
			return {
				isRunning: true,
				uuid: windowProcess.uuid,
				parentUuid: this.parentUUID,
				app: windowProcess,
			};
		});
	}

	/**
	 * Get a windowProcess information sync. We need this when a window starts up so that we have the information before anything tries to access it
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getAppInfoSync(eventObj) {
		const browserWin = eventObj.getBrowserWindow();
		let mainWin = await this.findWindowById(browserWin.id);
		if (!mainWin) {
			logger.error('getWindowProcessForWindow no window found');
			return;
		}
		const currentApp = await this.getWindowProcessByUUID(mainWin.appUUID);
		const detailsResponse = {
			name: currentApp.name,
			uuid: currentApp.uuid,
			browserWindowId: browserWin.id,
			title: browserWin.title,
			window: {
				name: currentApp.appWindow.windowName,
				title: browserWin.title
			}
		};
		eventObj.respondSync(detailsResponse);
	}

	/**
	 * Get a windows information sync. We need this when a window starts up so that we have the information before anything tries to access it
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getWindowInfoSync(eventObj) {
		const browserWin = eventObj.getBrowserWindow();
		let mainWin = await this.findWindowById(browserWin.id);
		eventObj.getBrowserWindow()
		if (!mainWin) {
			logger.error('getWindowProcessForWindow no window found');
			return;
		}
		const currentWindow = await this.findWindowById(mainWin.id);
		if (!currentWindow) return logger.error(`Current window not found. Params: ${mainWin.id}`);
		const detailsResponse = { uuid: currentWindow.appUUID, windowUUID: currentWindow.uuid, windowName: currentWindow.windowName };
		detailsResponse.details = currentWindow.details;
		detailsResponse.customData = currentWindow.customData || {};
		eventObj.respondSync(detailsResponse);
	}

	/**
	 * Handles the request for getting all windowProcess
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getAllWindowProcessesRequest(eventObj) {
		eventObj.respond(await this.getWindowProcessList());
	}

	/**
	 * Handles the request for getting all windows
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getAllWindowsRequest(eventObj) {
		eventObj.respond(await this.getAllWindows());
	}

	/**
	 * Handles the request to get a windowProcess for a window
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getWindowProcessForWindow(eventObj) {
		arg = eventObj.data;
		let win = await this.findWindowById(arg.id);
		if (!win) win = this.getWindowFromAppAndName(params.uuid, params.windowName);
		if (!win) {
			logger.warn('getWindowProcessForWindow no window found');
			return;
		}
		const app = await this.getWindowProcessByUUID(win.appUUID);
		response = { windowProcessUUID: app.uuid, name: app.name };
		eventObj.respond(response);
	}

	/**
	 * get all windows
	 */
	async getAllWindows() {
		const applicationList = await this.getWindowProcessList();
		const appKeys = Object.keys(applicationList);

		return appKeys.map((appKey) => {
			const app = applicationList[appKey];
			const appWindowBounds = app.appWindow.getBounds();
			const windowResponse = {
				uuid: app.uuid,
				mainWindow: {
					name: app.appWindow.windowName,
					top: appWindowBounds.top,
					right: appWindowBounds.right,
					bottom: appWindowBounds.bottom,
					left: appWindowBounds.left,
				},
				childWindows: [],
			};

			const windowKeys = Object.keys(app.windows);
			windowKeys.map((windowKey) => {
				const currentWindow = app.windows[windowKey];
				const currentWindowBounds = currentWindow.getBounds();
				currentWindowBounds.name = currentWindow.windowName;
				windowResponse.childWindows.push(currentWindowBounds);
			});
		});
	}

	/**
	 * @todo Should be moved to the windowProcess class
	 * Get all child windows of an applications.
	 * @param {BusEvent} eventObj
	 */
	async getWindows(eventObj) {
		const applicationList = await this.getWindowProcessList();
		const arg = eventObj.data;
		const app = applicationList[arg.uuid];
		const windowDetails = [];
		if (app) {
			for (const w in app.windows) {
				const win = app.windows[w];
				windowDetails.push({
					windowName: win.windowName,
					uuid: win.uuid,
				});
			}
		}
		eventObj.respond(windowDetails);
	}
}
const mainWindowProcessManager = new MainWindowProcessManager();
process.mainWindowProcessManager = mainWindowProcessManager;
module.exports = mainWindowProcessManager;
