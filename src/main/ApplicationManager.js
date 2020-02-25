const EventEmitter = require('events').EventEmitter;
const MainApplication = require('./MainApplication');
const MainBus = require('./MainBus');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const { getFolderLocation } = require('../common/helpers');
const logger = require('../logger/')();
const { nativeImage, BrowserWindow } = require('electron');
const PermissionsManager = require('../permissions/PermissionsManager');
const downloadCache = require('../common/downloadCache');

/**
 * This class manages all applications. Some system calls are caught here.
 */
class ApplicationManager extends EventEmitter {
	constructor() {
		super();
		this.applications = {};
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
		this.getAllApplicationsRequest = this.getAllApplicationsRequest.bind(this);
		this.getWindowInfoSync = this.getWindowInfoSync.bind(this);
		this.getAppInfoSync = this.getAppInfoSync.bind(this);
		this.getApplicationForWindow = this.getApplicationForWindow.bind(this);
		this.createApplicationRequest = this.createApplicationRequest.bind(this);
		this.createApplication = this.createApplication.bind(this);
		this.wrapApplication = this.wrapApplication.bind(this);
		this.getChildWindows = this.getChildWindows.bind(this);
		this.closeAllApplications = this.closeAllApplications.bind(this);
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
	}

	/**
	 * all of the events the manager listens for
	 *
	 * @return undefined
	 */
	// add permission string to unimplented listeners and make sure they are in defaultwindowoptions
	setupListeners() {
		PermissionsManager.addRestrictedListener('getAllWindows', this.getAllWindowsRequest, 'System.getAllWindows');
		PermissionsManager.addRestrictedListener('getAllApplications', this.getAllApplicationsRequest, 'System.getAllApplications');
		PermissionsManager.addRestrictedListener('syncWindowInfo', this.getWindowInfoSync, 'Window.syncWindowInfo');
		PermissionsManager.addRestrictedListener('syncAppInfo', this.getAppInfoSync, 'Application.syncAppInfo');
		PermissionsManager.addRestrictedListener('getApplicationForWindow', this.getApplicationForWindow); // nothing sends this event
		PermissionsManager.addRestrictedListener('createApplication', this.createApplicationRequest, 'Application.createApplication');
		PermissionsManager.addRestrictedListener('createWindowWithAffinity', this.spawnWithAffinityRequest, 'Window.createWindowWithAffinity');
		PermissionsManager.addRestrictedListener('wrapApplication', this.wrapApplication); // nothing sends this event
		PermissionsManager.addRestrictedListener('getChildWindows', this.getChildWindows, 'Application.getChildWindows');
		PermissionsManager.addRestrictedListener('startPollingCheck', this.startPollingCheck); // internal only
		MainBus.addListener('hideSplashScreen', this.hideSplashScreenFromBus);
		MainBus.addListener('showSplashScreen', this.showSplashScreenFromBus);
	}

	/**
	 * @private
	 * Helper function to get the list of applications safely
	 * Makes sure there is no pending application creation before returning list
	 */
	async getApplicationList() {
		// waits for a pending promise from app creation
		try {
			await this.creatingApp;
			return this.applications;
		} catch (err) {
			logger.error(`Failed to create application: ${err}`);
		}
	}

	getManifest() {
		return this.manifest;
	}

	setManifest(manifest) {
		this.manifest = manifest;
	}

	/**
	 * Create a new application request.
	 *
	 * @param {BusEvent} eventObj
	 */
	async createApplicationRequest(eventObj) {
		const args = eventObj.data;
		let isMain = false;
		let parentUUID = null;
		const windowCreatingApplication = await this.findWindowById(eventObj.respond.id);
		if (windowCreatingApplication) {
			isMain = false;	// TODO: consider removing this line
			const app = await this.getApplicationByID(windowCreatingApplication.appUUID);
			parentUUID = app.uuid;
		}
		const newApp = await this.createApplication(args, isMain, parentUUID);
		const response = {
			applicationUUID: newApp.uuid,
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
	 * create or get application with affinity and then create requested window
	 *
	 * @param {BusEvent} eventObj
	 */
	async spawnWithAffinityRequest(eventObj) {
		const args = eventObj.data;
		// If a window is specified to have windowType 'application' or 'OpenfinApplication', it should be isolated.
		// This means that it cannot have an affinity. If this line is removed, FEA things that the window is both
		// an application _and_ grouped with other windows in the same affinity. This causes all manner of strange bugs.
		// The LauncherService in finsemble _should_ prevent this from happening. However, if someone bypasses
		// the finsemble API and creates a new window via `new fin.desktop.Window(params)`,
		// the code below fixes this strange state.
		if (args.windowType && args.windowType.toLowerCase().includes('application')) delete args.affinity;
		const app = await this.getApplicationByAffinity(args.affinity);
		// if this application already exists
		if (app) {
			return app.createWindow(args, (err, createdWindow) => {
				const response = { applicationUUID: app.uuid, windowName: createdWindow.windowName };
				eventObj.respond(response);
			});
		}
		// We need to create a new application
		const newApp = await this.createApplication(args, false, (err, res) => {
			if (err) logger.error(`spawnWithAffinityRequest -> failed to create new app: ${err}`);
			logger.info(`New app created by spawnWithAffinityRequest: ${res}`);
		});
		const response = { applicationUUID: newApp.uuid, windowName: newApp.appWindow.windowName };
		eventObj.respond(response);
	}

	/**
	 * Internal create application call. If `isMain` is present it must be the manifest.
	 * @param {MainApplicationParams} params - The normal window information.
	 * @param {boolean} isMain - If not false, this must be the manifest.
	 * @param {UUID} parentUUID - The application that is making the requst.
	 * @param {Function} cb
	 * @return {MainApplication}
	 */
	async createApplication(params, isMain, parentUUID, cb = Function.prototype) {
		let app;
		// If a window is specified to have windowType 'application' or 'OpenfinApplication', it should be isolated.
		// This means that it cannot have an affinity. If this line is removed, FEA things that the window is both
		// an application _and_ grouped with other windows in the same affinity. This causes all manner of strange bugs.
		// The LauncherService in finsemble _should_ prevent this from happening. However, if someone bypasses
		// the finsemble API and creates a new window via `new fin.desktop.Window(params)`,
		// the code below fixes this strange state.
		if (params.windowType && params.windowType.toLowerCase().includes('application')) delete params.affinity;
		if (params.affinity) {
			params.appUUID = params.affinity;
			app = await this.getApplicationByAffinity(params.affinity);
		}

		// Get the permission set for the Application
		params.permissions = PermissionsManager.reconcilePermissions(PermissionsManager.systemPermissions, params.permissions);
		// Pull the trustedPreloads and domain finsemble is running in from the manifest. Both values are used to determine which preloads can be loaded
		params.trustedPreloads = this.manifest.electronAdapter.trustedPreloads;

		const startupAppUrl = this.manifest.startup_app.url;
		try {
			params.finsembleDomain = new URL(startupAppUrl).hostname;
		} catch (err) {
			logger.error(`${startupAppUrl} is not valid url`);
			params.finsembleDomain = null;
		}

		if (!app) app = new MainApplication(params);
		try {
			// save the unresolved promise in a variable so we can wait until the app is done being created before performing dependent actions.
			this.creatingApp = app.start(params);
			// Add the pending promise to process so a separate window request can wait until the app is created.
			process.creatingApp = this.creatingApp;
			await this.creatingApp;
		} catch (err) {
			logger.error(`Failed to create new application ${err.message}`);
			return cb(err);
		}

		if (isMain) {
			app.manifest = isMain;
			app.isMain = true;
		}
		app.parentUUID = parentUUID;
		this.applications[app.uuid] = app;
		app.addListener('close', this.applicationClosed.bind(this, app.uuid));
		cb(null, app);
		return app;
	}

	/**
	 * This allows us to get information about an application outside of that application.
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async wrapApplication(eventObj) {
		const currentApp = await this.getApplicationByID(eventObj.data.uuid);
		const response = { applicationUUID: currentApp.uuid, name: currentApp.name };
		eventObj.respond(response);
	}

	/**
	 * This is fired when an application is closed. The event is sent to all windows.
	 * @param {UUID} appUUID
	 */
	async applicationClosed(appUUID) {
		const applicationList = await this.getApplicationList();
		MainBus.sendEvent(`applicationEvent-${appUUID}.closed`, appUUID);
		if (applicationList[appUUID] && applicationList[appUUID].isMain) {
			delete this.applications[appUUID];
			this.closeAllApplications();
		} else {
			delete this.applications[appUUID];
		}
	}

	/**
	 * A helper to get an application by it's uuid
	 * @param {UUID} id
	 * @return {MainApplication}
	 */
	async getApplicationByID(id) {
		const applicationList = await this.getApplicationList();
		return applicationList[id];
	}

	/**
	 * send a message to all open applications to start polling for resources
	 *
	 * @returns undefined
	 */
	async startPollingResources() {
		const applicationList = await this.getApplicationList();
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
		const applicationList = await this.getApplicationList();
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
	 * Called when new application launches. If polling has started, send a request for the new application to begin polling.
	 */
	async startPollingCheck(eventObj) {
		const currentApp = await this.getApplicationByID(eventObj.data);
		// If polling has started and the current app is not polling send the request
		if (this.pollingStarted == true && !currentApp.polling) {
			this.applications[eventObj.data].polling = true;
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
		const applicationList = await this.getApplicationList();
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				// check the application window
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
		const applicationList = await this.getApplicationList();
		const applications = Object.values(applicationList);
		for (let i = 0; i < applications.length; i++) {
			const app = applications[i];
			if (app) {
				// check the application window
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
		const applicationList = await this.getApplicationList();
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
		logger.info(`Cannot get window from application ${appUUID}, name: ${name}`);
		return null;
	}

	/**
	 * @param {String} affinity
	 * @return {MainApplication}
	 */
	async getApplicationByAffinity(affinity) {
		const applicationList = await this.getApplicationList();
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
	 * Restart an application. This probably should be in the application class. We had issues so we just force a full restart if this is called.
	 * @param {UUID} uuid
	 * @param {MainApplication} app
	 * @return {Number}
	 */
	restartApplication(uuid, app) {
		logger.log('Restarting the application.');
		app.relaunch();
		return app.exit(0);
	}

	/**
	 * Loops through applications and closes them
	 */
	async closeAllApplications() {
		const applicationList = await this.getApplicationList();
		for (const a in applicationList) {
			const application = applicationList[a];
			application.close();
		}
	}

	/**
	 * Get a full list of application
	 *
	 * @return {MainApplication[]}
	 */
	async getAllApplications() {
		const applicationList = await this.getApplicationList();
		const appKeys = Object.keys(applicationList);
		return appKeys.map((appKey) => {
			const app = applicationList[appKey];
			return {
				isRunning: true,
				uuid: app.uuid,
				parentUuid: this.parentUUID,
				app,
			};
		});
	}

	/**
	 * Get an application information sync. We need this when a window starts up so that we have the information before anything tries to access it
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getAppInfoSync(eventObj) {
		const params = eventObj.data;
		if (!params.id) {
			logger.debug(`No id found in ${params} for getAppInfoSync.`);
		}
		let win = await this.findWindowById(params.id);
		if (!win) win = this.getWindowFromAppAndName(params.uuid, params.windowName);
		if (!win) {
			logger.error('getApplicationForWindow no window found');
			return;
		}
		const currentApp = await this.getApplicationByID(win.appUUID);
		// This shape is consistent with the required information that is returned from OF.
		const detailsResponse = {
			name: currentApp.name,
			uuid: currentApp.uuid,
			window: {
				name: currentApp.appWindow.windowName
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
		const params = eventObj.data;
		if (!params.id) {
			logger.debug(`No id found in ${params} for getWindowInfoSync.`);
		}

		const currentWindow = await this.findWindowById(params.id);
		if (!currentWindow) return logger.error(`Current window not found. Params: ${params}`);
		const detailsResponse = { uuid: currentWindow.appUUID, windowUUID: currentWindow.uuid, windowName: currentWindow.windowName };
		detailsResponse.details = currentWindow.details;
		detailsResponse.customData = currentWindow.customData || {};
		eventObj.respondSync(detailsResponse);
	}

	/**
	 * Handles the request for getting all application
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getAllApplicationsRequest(eventObj) {
		eventObj.respond(await this.getAllApplications());
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
	 * Handles the request to get an application for a window
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	async getApplicationForWindow(eventObj) {
		arg = eventObj.data;
		let win = await this.findWindowById(arg.id);
		if (!win) win = this.getWindowFromAppAndName(params.uuid, params.windowName);
		if (!win) {
			logger.warn('getApplicationForWindow no window found');
			return;
		}
		const app = await this.getApplicationByID(win.appUUID);
		response = { applicationUUID: app.uuid, name: app.name };
		eventObj.respond(response);
	}

	/**
	 * get all windows
	 */
	async getAllWindows() {
		const applicationList = await this.getApplicationList();
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
	 * @todo Should be moved to the application class
	 * Get all child windows of an applications.
	 * @param {BusEvent} eventObj
	 */
	async getChildWindows(eventObj) {
		const applicationList = await this.getApplicationList();
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
const applicationManager = new ApplicationManager();
process.applicationManager = applicationManager;
module.exports = applicationManager;
