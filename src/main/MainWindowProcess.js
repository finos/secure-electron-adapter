const uuidV4 = require('uuid/v4');
const MainWindow = require('./MainWindow');
const EventEmitter = require('events').EventEmitter;
const MainBus = require('./MainBus');
const PermissionsManager = require('../permissions/PermissionsManager');
const logger = require('../logger')();
const get = require("lodash.get");

/**
 * @todo we still use appWindow for the main window of get all windows. We'll need to find a fix for that before removing it completely.
 */

/**
 * All windows must be apart of a windowProcess and their references are stored here
 */
module.exports = class MainWindowProcess extends EventEmitter {
	/**
	 *
	 * @param {MainWindowProcessParams} params
	 */
	constructor(params) {
		super();
		this.windows = {};// List of windows
		this.appWindow = null;// The main windowProcess window. It is also stored in the child window list
		this.details = params;
		this.affinity = params.affinity;
		this.state = null;
		this.peakWorkingSetSize = 0;
		this.manifest = params.manifest;
		this.permissions = params.permissions;
		this.trustedPreloads = params.trustedPreloads;
		this.uuid = params.uuid || uuidV4();
		// If the name isn't provided, default to the windowProcess's UUID.
		this.name = params.name || this.uuid;
		this.trustedDomain = params.trustedDomain;
		this.bind();
	}

	/**
	 * Creates the windowProcess's window. Each window has a main window and a list of child windows.
	 * @param {MainWindowProcessParams} params
	 * @param {Function} cb
	 *
	 * @return undefined
	 */
	async start(params, cb = Function.prototype) {
		this.setupListeners();
		// console.log("Creating MainWindowProcess window:", params);
		try {
			const win = await this.createWindow(params);
			this.processId = this.getProcessId();
			cb(null);
		} catch (err) {
			logger.error(`Failed to create the windowProcess window ${err.message}`);
			cb(err);
		}
	}

	/**
	 * bind functions to class context
	 * @return undefined
	 */
	bind() {
		this.windowClosed = this.windowClosed.bind(this);
		this.start = this.start.bind(this);
		this.setupListeners = this.setupListeners.bind(this);
		this.createWindowRequest = this.createWindowRequest.bind(this);
		this.closeRequest = this.closeRequest.bind(this);
		this.getManifest = this.getManifest.bind(this);
		this.resourceUpdate = this.resourceUpdate.bind(this);
		this.getHeuristics = this.getHeuristics.bind(this);
		this.createWindow = this.createWindow.bind(this);
		this.getProcessId = this.getProcessId.bind(this);
	}

	/**
	 * WindowProcess specific events
	 * @return undefined
	 */
	setupListeners() {
		PermissionsManager.addRestrictedListener(`${this.uuid}-spawn`, this.createWindowRequest, 'WindowProcess.spawn');
		PermissionsManager.addRestrictedListener(`WindowProcess-${this.uuid}-close`, this.closeRequest, 'WindowProcess.close');
		PermissionsManager.addRestrictedListener(`${this.uuid}-getManifest`, this.getManifest, 'WindowProcess.getManifest');
		MainBus.addListener(`${this.uuid}-resourceUpdate`, this.resourceUpdate);
	}

	// @todo this needs documentation.
	// What is it? Why is it being used?
	getProcessId() {
		let appWindowProcId;
		if (this.appWindow && this.appWindow.win && this.appWindow.win.webContents) {
			appWindowProcId = this.appWindow.win.webContents.getOSProcessId();
		} else if (!this.processId && this.appWindow && this.appWindow.windowName) {
			logger.warn(`Cannot find window's process id for window ${this.appWindow.windowName}`);
		}
		return this.processId || appWindowProcId;
	}

	/**
	 * get process usage data for the given app
	 *
	 * @param {MainWindowProcess} app
	 * @return {Object} process usage data
	 */
	getHeuristics() {
		// Chose not to log here given the frequency it's called.
		return {
			cpuUsage: this.resources ? this.resources.cpuUsage : 0, // the percentage of total CPU usage
			name: this.uuid, // the windowProcess name
			peakWorkingSetSize: this.peakWorkingSetSize, // the peak working set size in bytes
			processId: this.getProcessId(), // the native process identifier
			uuid: this.uuid, // the windowProcess UUID
			workingSetSize: (this.resources) ? this.resources.memUsageRSS : 0, // the current working set size (both shared and private data) in bytes
		};
	}

	/**
	 * update the resources object on the windowProcess with new information.
	 * set a peakWorkingSetSize if rss is a new maximum
	 *
	 * @param {Object} eventObj
	 */
	resourceUpdate(eventObj) {
		const update = eventObj.data;
		this.resources = update;
		const memoryUsageHasGrown = update && (update.memUsageRSS > this.peakWorkingSetSize);
		if (memoryUsageHasGrown) {
			this.peakWorkingSetSize = update.memUsageRSS;
		}
	}

	/**
	 * When a window within a windowProcess closes the windowProcess is informed. If it's the last window in the windowProcess, the windowProcess closes itself.
	 *
	 * @param {String} windowName
	 * @return undefined
	 */
	windowClosed(windowName) {
		// If the window closed is part of this windowProcess, clean up the close listener.
		if (windowName in this.windows) {
			this.windows[windowName].removeListener('close', this.windowClosed);
		}

		// Remove the window from the windowProcess's cache of windows
		// (If the closed window doesn't belong to the windowProcess, nothing will happen).
		delete this.windows[windowName];


		// If the closing window is the appWindow, delete the reference to it.
		if (get(this.appWindow, "windowName") === windowName) {
			delete this.appWindow;
		}

		logger.log(`Window ${windowName} closed.`);

		// If no more windows exist, it's time to shut down the windowProcess.
		if (!Object.keys(this.windows).length) {
			if (this.state === 'restarting') { // Handle restart if in that state and no more windows are open
				return this.finishRestart();
			}
			this.close();
		}
	}

	/**
	 * This is called when a request comes in to close a windowProcess.
	 * @param {BusEvent} eventObj
	 * @return undefined
	 */
	closeRequest(eventObj) {
		eventObj.respond({ status: 'success' });
		this.close();
	}

	/**
	 * This closes all child windows and then closes the windowProcess.
	 *
	 * @return undefined
	 */
	close() {
		logger.info(`Closing windowProcess ${this.uuid}`);
		const windowKeys = Object.keys(this.windows);
		windowKeys.map((windowKey) => {
			const currentWindow = this.windows[windowKey];
			currentWindow.close();
		});
		if (this.appWindow) this.appWindow.close();
		logger.log(`APPLICATION LIFECYCLE: WindowProcess ${this.uuid} closed.`);
		this.emit('close');
	}

	/**
	 * This will recreate the main window if a windowProcess is restarted.
	 * //@todo Does this work?
	 */
	async finishRestart() {
		await this.start(this.details);
	}

	/**
	 * Set the current state to restart and call the close method
	 * @todo see if this is even used. I don't think it is. Candidate for deletion
	 */
	restart() {
		this.state = 'restarting';
		this.close();
	}

	/**
	 * This only works for the main windowProcess. It gets the startup manifest.
	 * @param {BusEvent} eventObj
	 */
	getManifest(eventObj) {
		eventObj.respond(this.manifest);
	}

	/**
	 * Handles a request to create a window for a windowProcess
	 * @param {BusEvent} eventObj
	 */
	async createWindowRequest(eventObj) {
		// wait for windowProcess to finish being created before creating the window.
		await process.creatingApp;
		const mainWindow = await this.createWindow(eventObj.data, (err, res) => {
			if (err) logger.error('createWindowRequest failed');
			else logger.log(`Window created: ${res.windowName}`);
		});
		eventObj.respond({ windowName: mainWindow.windowName, appUUID: this.uuid });
	}

	/**
	 * Creates a window and adds it to the child window list
	 * @param {MainWindowParams} params
	 * @param {Function} cb
	 */
	async createWindow(params, cb = Function.prototype) {
		logger.debug(`MainWindowProcess->CreateWindow. Creating window ${params.name}`);
		params.appUUID = this.uuid;

		// create a combined permission set for the new window using the windowProcess's permissions and the window's requested permissions, keeping the more restrictive ones
		params.permissions = PermissionsManager.reconcilePermissions(this.permissions, params.permissions);
		// Set initial trustedPreloads from the manifest value
		params.trustedPreloads = this.trustedPreloads;
		// Domain windowProcess is running on
		params.trustedDomain = this.trustedDomain

		if (!params.execJSWhitelist) params.execJSWhitelist = [];
		params.execJSWhitelist.push(this.details.name);

		try {
			const mainWindow = new MainWindow(params);
			// MainWindowProcessManager.findWindowByName loops through windowProcesses and looks at the appWindow property.
			// mainWindow.init will create restricted listeners, which will use findWindowByName.
			// If we don't assign appWindow here, there will be an uncaught exception.
			// This assignment only happens once.
			if (!this.appWindow) this.appWindow = mainWindow;
			logger.verbose(`WindowProcess ${this.details.name} initializing ${mainWindow.windowName}.`);
			await mainWindow.init();
			logger.verbose(`WindowProcess ${this.details.name} initialized ${mainWindow.windowName}.`);
			// @todo refactor: No anonymous handlers.
			mainWindow.addListener('close', () => {
				logger.debug(`WindowProcess ${this.details.name} received close event for ${mainWindow.windowName}`);
				this.windowClosed(mainWindow.windowName);
			});
			this.windows[mainWindow.windowName] = mainWindow;
			cb(null, mainWindow);
			return mainWindow;
		} catch (err) {
			cb(err);
		}
	}
};
