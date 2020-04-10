/**
 * Main Window. Handles all interactions with a window
 */


const path = require('path');
const electron = require('electron');
const { session } = require('electron');
const downloadCache = require('../common/downloadCache');
const windowStore = require('../common/helpers/windowsStore');

const BrowserWindow = electron.BrowserWindow;
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const mkdirp = require('mkdirp');
const download = require('../common/download');
const MainBus = require('./MainBus');
const defaultWindowOptions = require('../permissions/defaultWindowOptions');
const windowEventListeners = require('../permissions/windowEventListeners');
const PermissionsManager = require('../permissions/PermissionsManager');
const cachePath = require('./helpers/getCachePathSync')();
const remoteModuleFolderPath = require('./helpers/getRemoteModuleFolderPathSync')();
const logger = require('../logger/')();
const {
	getFilenameFromURL, getCookieHeader, isValidURL, getFilenameTrustedPreloadDeprecationWarning
} = require('../common/helpers');
const stringify = require('../common/helpers/safeStringify');



global.windows = {};
global.preloadsLoaded = {};
global.preload = {};

let movingWindow;
let resizingWindow;
let resizeEdges = [];
let staticEdges = {};
const WINAPI = { // https://wiki.winehq.org/List_Of_Windows_Messages
	WM_ENTERSIZEMOVE: 561,
	WM_EXITSIZEMOVE: 562,
};
module.exports = class MainWindow extends EventEmitter {
	/**
	 * creates a window or reference to an existing window
	 * @param {MainWindowParams} params
	 * @param {Function} cb
	 */
	constructor(params, cb = Function.prototype) {
		super();
		// Need to remove one of these. Windows should probably be tracked by UUID instead of name
		this.uuid = params.appUUID;
		this.windowName = params.name;
		this.appUUID = params.appUUID;
		this.apiHandlers = {};
		this.bindFunctions = this.bindFunctions.bind(this);
		this.bindFunctions();
		this.movable = true;
		this.isMoving = false;
		this.closeRequested = false; // Toggles to true when the application has registered a "close-requested" event. When this is true, automatic window closes are disabled.
		params.backgroundColor = undefined;
		this.url = params.url;
		this.lastMove = Date.now(); // Timestamp for last time a window was moved. Used to suppress extra move event when the OS moves a window.
		this.customData = params.customData || {};
		if (params.mainWindowOptions && params.mainWindowOptions.customData) {
			this.customData = params.mainWindowOptions.customData;
		}
		this.permissions = params.permissions;
		this.trustedDomain = params.trustedDomain;
		this.trustedPreloads = params.trustedPreloads || [];
		this.originalParams = params;
		// This stores the information used to create the window
		// @todo fix this... :vomit: We need a proper merge method that's easy to follow.
		this.myOpts = Object.assign({}, defaultWindowOptions, params, {
			width: params.defaultWidth || 800,
			height: params.defaultHeight || 600,
			x: params.defaultLeft || 0,
			y: params.defaultTop || 0,
			url: params.url,
			show: params.visible || false,
			icon: params.icon,
			title: params.name,
			frame: params.frame,
			skipTaskbar: params.showTaskbarIcon === false,
			autoHideMenuBar: true,
			acceptFirstMouse: true,
			webPreferences: {
				webSecurity: true,
				nodeIntegration: false,
				contextIsolation: true,
				enableRemoteModule: false,
				sandbox: true,
				affinity: MainWindow._getAffinityForWindow(params, this.appUUID),
				preload: path.join(__dirname, 'sea.js'), // Preload sea.js. All other preloads are done in sea.js
			},
		});
	}

	/**
	 * async post constructor initialization
	 */
	async init() {
		this.makePreloadDirectories();
		const preloadsAllowed = PermissionsManager.checkPermission(this, 'Window.webPreferences.preload');
		const trustedPreloads = this.handleTrustedPreloads({
			fileList: this.originalParams.preload,
			preloadsAllowed,
			trustedDomain: this.trustedDomain
		});
		await this.downloadPreloadFiles(trustedPreloads);
		// Make sure all preloads are downloaded, then create an Electron Window
		await this.createBrowserWindow();

		// Set disable zoom for all windows according to default window options
		if (defaultWindowOptions.webPreferences.disableZoom) {
			const { webContents } = this.win;
			webContents.on('did-finish-load', () => {
				webContents.zoomFactor = 1;
				webContents.setVisualZoomLevelLimits(1, 1);
			});
		}
	}

	/**
	 * all of the functions that can be called
	 */
	bindFunctions() {
		this.sendEventToWindows = this.sendEventToWindows.bind(this);
		this.createBrowserWindow = this.createBrowserWindow.bind(this);
		this.sendEventToApplication = this.sendEventToApplication.bind(this);
		this.convertBoundsInfo = this.convertBoundsInfo.bind(this);
		this.getBounds = this.getBounds.bind(this);
		this.getBoundsFromSystem = this.getBoundsFromSystem.bind(this);
		this.setBounds = this.setBounds.bind(this);
		this.updateOptions = this.updateOptions.bind(this);
		this.getDetails = this.getDetails.bind(this);
		this.showAt = this.showAt.bind(this);
		this.show = this.show.bind(this);
		this.blur = this.blur.bind(this);
		this.hide = this.hide.bind(this);
		this.close = this.close.bind(this);
		this.minimize = this.minimize.bind(this);
		this.bringToFront = this.bringToFront.bind(this);
		this.restore = this.restore.bind(this);
		this.isShowing = this.isShowing.bind(this);
		this.executeJavaScript = this.executeJavaScript.bind(this);
		this.showDeveloperTools = this.showDeveloperTools.bind(this);
		this.focus = this.focus.bind(this);
		this.closeRequestedAdd = this.closeRequestedAdd.bind(this);
		this.closeRequestedRemove = this.closeRequestedRemove.bind(this);
		this.setupMainBusListeners = this.setupMainBusListeners.bind(this);
		this.setupWindowEventListeners = this.setupWindowEventListeners.bind(this);
		this.customWindowEvents = this.customWindowEvents.bind(this);
		this.onDevtoolsClosed = this.onDevtoolsClosed.bind(this);
	}

	/**
	 * Converts electron bounds into bounds that the windowProcess can use. The key difference is that
	 * electron uses x/y, and the windowProcess uses left/top.
	 * @param {WindowBounds} bounds
	 */
	convertBoundsInfo(bounds) {
		bounds.left = bounds.x;
		bounds.top = bounds.y;
		bounds.bottom = bounds.top + bounds.height;
		bounds.right = bounds.left + bounds.width;
		return bounds;
	}

	/**
	 * Attempts to set up a listener for each API method that is enabled.
	 * If a function is not permitted the accessDenied listener will be attached instead.
	 */
	async setupMainBusListeners() {
		if (this.permissions && this.permissions.Window) {
			for (const name of Object.keys(this.permissions.Window)) {
				// only attempt to add a listener for MainWindow class functions
				if (this[name]) {
					let topic = `${this.windowName}-${name}`;

					// When a window is of type "application", some events will be handled on both the Window and the WindowProcess.
					// For now, we only handle this discrepancy on the close event because it causes an error.
					// The error happens because we try to check permissions on the window, but it's already been closed by the application shutting down.
					// The code below just adds a prefix so that the application and window receive separate events.
					// Long-term this fix will apply to all application and window events
					if (name === 'close') {
						topic = `Window-${topic}`;
					}
					const handler = await PermissionsManager.addRestrictedListener(topic, this[name], `Window.${name}`);
					// cache the modified handler to remove when the window closes.
					this.apiHandlers[name] = handler;
				}
			}
		}
	}

	/**
	 * Removes every modified handler that was added when the window was created. The modified handler does the dirty work of checking to see if the caller has permissions to invoke the API method.
	 */
	removeAPIHandlers() {
		Object.keys(this.apiHandlers).forEach((handlerName) => {
			MainBus.removeListener(`${this.windowName}-${handlerName}`, this.apiHandlers[handlerName]);
		});
		delete this.apiHandlers;
		logger.info(`API handlers removed for ${this.windowName}`);
	}

	/**
	 * Setup event listeners on the electron window.
	 * When a 'native' event happens, push it out to the rest of the system.
	 */
	setupWindowEventListeners() {
		windowEventListeners.forEach((listener) => {
			this.win.on(listener.name, () => this.sendEventToWindows(listener.functionName, { name: listener.name }));
		});
	}

	/**
	 * Any window event listeners that don't follow the base case handled in `setupWindowEventListeners`
	 */
	customWindowEvents() {
		// When the close event (which is essentially a request) fires, prevent the event if someone is
		// listening on close - requested.Otherwise nothing happens.
		this.win.on('close', (event) => {
			if (this.closeRequested) {
				logger.info('Blocking window close because of registered `close-requested` event');
				event.preventDefault();
				this.sendEventToWindows('close-requested', { name: this.windowName });
			}
		});


		// When the window has finally closed, remove all of the listeners we created
		// and let the rest of the system know that we've gone down.
		this.win.on('closed', (event) => {
			// Get rid of all subscribers so if a window with the same name is reincarnated, SEA won't blow up.
			MainBus.unsubscribeWindow(this.windowName);
			this.removeAPIHandlers();
			windowStore.delete(this.windowName);
			this.emit('close', this.windowName);

			this.sendEventToWindows('closed', { name: this.windowName });
			// Since win.close() was successful, we don't need to destroy the window
			clearTimeout(this.destoryWindowTimer);
		});
	}

	/**
	 * Changes the 'closeRequested' boolean. This is a value that changes the way the window closes.
	 * If it is true, the window will wait for the program to do some work before closing the window.
	 * If it is false, nothing changes.
	 */
	closeRequestedAdd() {
		this.closeRequested = true;
	}

	closeRequestedRemove() {
		this.closeRequested = false;
	}

	/**
	 * Send a message to all applications. Right now, we don't know which windows are listening for which events so we send the events to all windows.
	 * @param {String} event
	 * @param {Object} data
	 */
	sendEventToApplication(event, data) {
		MainBus.sendEvent(`windowProcessEvent-${this.appUUID}.${event}`, data);
	}

	/**
	 * Send a message to all windows. Right now, we don't know which windows are listening for which events so we send the events to all windows.
	 * @param {String} event
	 * @param {Object} data
	 */
	sendEventToWindows(event, data) {
		MainBus.sendEvent(`windowEvent-${this.windowName}.${event}`, data);
	}

	/**
	 * Update the window options. Right now, actions only occur on four options
	 * @param {BusEvent} eventObj
	 */
	updateOptions(eventObj) {
		const options = eventObj.data.options;
		// permissions and securityPolicy are both protected options. The user cannot modify them once the window is created.
		if (Object.keys(options).length) {
			options.permissions = this.details.permissions;
			options.securityPolicy = this.details.securityPolicy;
		}
		for (const o in options) {
			switch (o) {
			case 'opacity':
				this.win.setOpacity(options[o]);
				break;
			case 'alwaysOnTop':
				this.win.setAlwaysOnTop(options[o]);
				break;
			case 'showTaskbarIcon':
				this.win.setSkipTaskbar(!options[o]);
				break;
			case 'resizable':
				this.win.setResizable(options[o]);
				break;
			}
		}
		this.details = Object.assign(this.details, options);
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Get a windows options.
	 * @param {BusEvent} eventObj
	 */
	getDetails(eventObj) {
		const detailsResponse = this.details;
		detailsResponse.name = this.windowName;
		detailsResponse.container = 'Electron';
		detailsResponse.customData = this.customData || {};
		eventObj.respond(detailsResponse);
	}

	/**
	 * When devtools are closed, we reset the reference so a new window is
	 * created the next time the dev tries to inspect a window.
	 */
	onDevtoolsClosed() {
		logger.debug(`Closing devtools for window ${this.windowName}`);
		this.devtools = null;
	}

	/**
	 * Show the developer tools for a window
	 * @param {BusEvent} eventObj
	 */
	showDeveloperTools(eventObj) {
		logger.debug(`Showing devtools for window ${this.windowName}`);
		if (!this.devtools) {
			this.devtools = new BrowserWindow({
				title: `Developer Tools - ${this.myOpts.url}`,
			});
			this.win.webContents.setDevToolsWebContents(this.devtools.webContents);
			this.win.webContents.openDevTools({ mode: 'detach' });
			this.devtools.addListener('closed', this.onDevtoolsClosed);
		} else {
			this.devtools.focus();
		}
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Set the bounds of a window
	 * @param {BusEvent} eventObj
	 */
	setBounds(eventObj) {
		const params = eventObj.data.bounds;
		this.win.setBounds(params);
	}

	/**
	 * Gets the window bounds from the system. Used to determine where the system moved the window after a monitor change
	 * @param {*} eventObj
	 * TODO: getBounds returns the last location as SEA knows it instead of asking the system. Test if using the last location is really necessary to see if this function can be merged with getBounds.
	 */
	getBoundsFromSystem(eventObj) {
		const bounds = this.win.getBounds() || this.lastSizeMoveLoc;
		const convertedBounds = {
			left: bounds.x,
			top: bounds.y,
			height: bounds.height,
			width: bounds.width,
			bottom: bounds.y + bounds.height,
			right: bounds.x + bounds.width
		};

		if (eventObj) eventObj.respond(convertedBounds);
		return convertedBounds;
	}

	/**
	 * Get the bounds of a window
	 * @param {BusEvent} eventObj
	 */
	getBounds(eventObj) {
		// @todo this is a scary method to behold. Either use this.location or get the bounds from electron.
		// bounds is either that, or the lastMoveLoc. This smells like code that was necessary
		// to get something working quickly. We should determine in which scenarios these things
		// may happen.
		let bounds = this.convertBoundsInfo(this.location || this.win.getBounds());
		bounds = bounds || this.lastSizeMoveLoc;
		if (eventObj) eventObj.respond(bounds);
		return bounds;
	}

	/**
	 * Show a window at a specific location. The show here does not set focus.
	 * @param {BusEvent} eventObj
	 */
	showAt(eventObj) {
		const params = eventObj.data;
		if (!this.win) return;
		logger.debug(`Showing window ${this.windowName} at (${params.top}, ${params.left})`);
		this.win.setPosition(params.left, params.top);
		this.win.showInactive();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Is a window visible
	 * @param {BusEvent} eventObj
	 */
	isShowing(eventObj) {
		eventObj.respond(this.win.isVisible());
	}

	/**
	 * Show a window. This will set focus
	 * @param {BusEvent} eventObj
	 */
	show(eventObj) {
		logger.verbose(`Showing window ${this.windowName}.`);
		this.win.showInactive();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Hide the window
	 * @param {BusEvent} eventObj
	 */
	hide(eventObj) {
		logger.verbose(`Hiding window ${this.windowName}.`);
		this.win.hide();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Focus the window
	 * @param {BusEvent} eventObj
	 */
	focus(eventObj) {
		logger.verbose(`Focusing window ${this.windowName}.`);
		this.win.focus();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Blur the window
	 * @param {BusEvent} eventObj
	 */
	blur(eventObj) {
		logger.verbose(`Blurring window ${this.windowName}.`);
		this.win.blur();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Close the window. IF the window is the last in an application it will close the application too.
	 * @param {BusEvent} eventObj
	 */
	close(eventObj) {
		if (eventObj && eventObj.data && eventObj.data.force === true) {
			// Make sure we don't prevent Electron from closing the window when forcing close.
			this.closeRequested = false;
		}
		let response = null;
		logger.log(`WINDOW LIFECYCLE: Closing window ${this.windowName}.`);
		if (!this.win) logger.error('WINDOW LIFECYCLE: Attempting to close a window that\'s not defined.');
		this.emit('close', this.windowName);
		try {
			this.win.close();
			this.destoryWindowTimer = this.destoryWindow();
			response = { status: 'success' };
		} catch (e) {
			logger.warn(`WINDOW LIFECYCLE: Could not close window ${this.windowName}.`);
			response = { status: 'failure' };
		}
		if (eventObj) {
			return eventObj.respond(response);
		}
		return null;
	}

	/**
	 * Destroys the window after a specified duration
	 * @param {number} duration The duration in milliseconds
	 * @private
	 */
	destoryWindow(duration = 500) {
		return setTimeout(() => {
			if (this.win && !this.win.isDestroyed()) {
				try {
					logger.info(`Destroying window ${this.windowName}`);
					this.win.destroy();
				} catch (err) {
					logger.warn(`Failed to destroy window ${this.windowName}, ${err.message}`);
				}
			}
		}, duration);
	}

	/**
	 * Minimize the window
	 * @param {BusEvent} eventObj
	 */
	minimize(eventObj) {
		logger.debug(`Minimizing window ${this.windowName}.`);
		this.win.minimize();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Sets the window to always on top. This will bring it to the top of the stack of windows.
	 * Immediately afterwards, changes alwaysOnTop to false. This allows other windows to sit on top of it
	 * when they're focused. BringToFront isn't actually an electron method.
	 * **NOTE**: This only happens if the window is not 'alwaysOnTop'. If the window is always on top, it's already
	 * brought to front.
	 */
	bringToFront(eventObj) {
		logger.debug(`Bringing window ${this.windowName} to front.`);
		if (!this.myOpts.alwaysOnTop) {
			this.win.setAlwaysOnTop(true);
			this.win.setAlwaysOnTop(false);
		}
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Restore a window from minimize or maximize.
	 * @param {BusEvent} eventObj
	 */
	restore(eventObj) {
		logger.debug(`Restoring window ${this.windowName} to front.`);
		this.win.restore();
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Execute javascript in the window. We only allow the creator of the window to call this method.
	 * @param {BusEvent} eventObj
	 */
	async executeJavaScript(eventObj) {
		logger.debug(`Calling execute javascript on ${this.windowName}.`);

		const senderOpts = eventObj.sender.browserWindowOptions;
		const { execJSWhitelist } = this.myOpts;
		const whiteListIds = await this._getIdsFromWindowNames(execJSWhitelist);
		if (whiteListIds.includes(eventObj.sender.webContents.id)) {
			const result = await this.win.webContents.executeJavaScript(eventObj.data.script, true);
			logger.debug(`executeJavaScript for window ${this.windowName} returned `, result);
			eventObj.respond({ status: 'success' });
		} else {
			const err = {
				status: 'error',
				code: 'access_denied',
				message: `executeJavaScript is only allowed if invoked upon child windows. Window ${senderOpts.name} did not create ${this.windowName}.`
			};
			eventObj.respond(err);
			logger.warn(`executeJavaScript failed for window ${this.windowName}: {err.message}`);
		}
	}

	/**
	 * Takes the list of window names and
	 * returns a list of window IDs
	 * @param {Array} windowNames List of window names
	 * @returns {Array}
	 * @private
	 */
	async _getIdsFromWindowNames(windowNames) {
		const whiteListIds = [];
		if (windowNames) {
			// So it looks like executeJavaScript is invoked
			// once when execJSWhitelist has a list of names.
			// Then it gets invoked again with the already
			// made list which has a list of IDs instead of names.
			// Why? I'm not sure, somebody help me here.
			// That is why I'm returning the already-made list of IDs
			// otherwise we will have [undefined, undefined, ...]
			const isDone = windowNames.find(item => /^(?!undefined|\d)/.test(item));
			if (!isDone) return windowNames;
			// Otherwise continue building ID list.
			for (let i = 0; i < windowNames.length; i++) {
				const winObj = await process
					.mainWindowProcessManager
					.findWindowByName(windowNames[i]);
				whiteListIds.push(winObj ? winObj.id : undefined);
			}
		}
		return whiteListIds;
	}

	/**
	 * Annotates a list of files. Returns an array of objects that tells whether the file is permitted to
	 * be preloaded and whether it should be added to the existing list of trusted preloads.
	 *
	 * @static
	 * @param {*} params
	 * @returns Array<{ url, isPermitted, addToTrusted }>
	 */
	static _annotatePreloadList(params) {
		const {
			trustedDomain, preloadsAllowed, fileList, trustedPreloads
		} = params;
		const annotatedFileList = [];
		// Create a list of permitted preloads from the preloads requested
		for (let i = 0; i < fileList.length; i++) {
			const item = fileList[i];
			const fileName = getFilenameFromURL(item.url);
			let url = item.url;
			if (!isValidURL(url)) {
				// @deprecate. In 4.0, Skip this item if it's not a valid URL.
				logger.error(getFilenameTrustedPreloadDeprecationWarning(item.url));
				url = fileName;
			}
			// If preloads are always permitted, we need to permit every file.
			// The only question is whether it needs to be added to the trusted preload list.
			if (preloadsAllowed) {
				annotatedFileList.push({
					url,
					isPermitted: true,
					addToTrusted: !trustedPreloads.includes(url)
				});

				// @deprecate Remove in 4.0
				// If the user supplied a valid URL (url and filename won't be equal), we need to
				// go ahead and permit the filename. This was the behavior in 3.8.x.
				// It will be deprecated in 4.0.
				if (url !== fileName) {
					annotatedFileList.push({
						url: fileName,
						isPermitted: true,
						addToTrusted: !trustedPreloads.includes(fileName)
					});
				}

				// If preload permissions are disabled only allow trusted preloads to be loaded
			} else if (trustedPreloads.includes(url)) {
				annotatedFileList.push({
					url,
					isPermitted: true,
					addToTrusted: false
				});
				// Preloads aren't permitted and the requested preload isn't trusted
			} else {
				logger.info(`Preload not allowed. File will not be downloaded: ${url} `);
				annotatedFileList.push({
					url,
					isPermitted: false,
					addToTrusted: false
				});
			}
		}
		return annotatedFileList;
	}

	/**
	 * Takes list of passed in preloads, formats them, and returns an allowed Preload list
	 * If preloads are permitted, all preloads will be consider trusted and those preloads will now be considered trusted for child windows.
	 * If preloads are not permitted, only trusted preloads will be returned
	 * @param {Object} params
	 */
	handleTrustedPreloads(params) {
		let { fileList } = params;
		const { preloadsAllowed } = params;
		if (!fileList) return [];

		if (fileList && typeof fileList === 'string') {
			fileList = [{ url: fileList }];
		}

		if (!fileList.length) return [];

		// @todo because _annotatePreloadList doesn't know which window it's operating on, we can provide useful logs, e.g. ("preload ${url} allowed on window: ${windowName}"). We should devise some way to log a helpful list of allowed/disallowed preloads for a given request.

		// Get an array of these urls. The returned object will tell us whether the file is permitted (should we download it),
		// and whether it should be added to the trusted preloads array.
		const annotatedPreloads = MainWindow._annotatePreloadList({
			fileList,
			preloadsAllowed,
			trustedPreloads: this.trustedPreloads,
			trustedDomain: params.trustedDomain
		});


		// Add all of the trusted preloads to the trustedPreloads array.
		annotatedPreloads
			.filter(preload => preload.addToTrusted)
			.forEach(item => this.trustedPreloads.push(item.url));

		// isPermitted means 'should it be downloaded.'
		// see annotatePreloadList to understand why a preload would or would not be downloaded.
		return annotatedPreloads.filter(preload => preload.isPermitted);
	}

	/**
	 *
	 * If a window is specified to have windowType 'application', it should be isolated.
	 * @static
	 * @param {browserWindowOptions} params
	 * @param {string} windowProcessUUID
	 * @returns string
	 */
	static _getAffinityForWindow(params, windowProcessUUID) {
		let affinity = params.affinity || windowProcessUUID;

		// if the window is an 'application', it cannot have an affinity. Default to the appUUID.
		if (params.windowType && params.windowType.toLowerCase().includes('application')) {
			affinity = windowProcessUUID;
		}

		return affinity;
	}

	/**
	 * Creates our preloads list. Electron does not take an array of preloads. Also, for some reason, preloads won't take a remote file
	 * Preload list is filtered based on preload permissions.
	 * @param {MainWindowParams} params
	 */

	async createBrowserWindow() {
		logger.debug(`Creating physical browserWindow for ${this.windowName}`);
		logger.verbose(`BrowserWindow options for ${this.windowName}, ${stringify(this.myOpts)}`);
		this.win = new BrowserWindow(this.myOpts);
		// This is to get around an electron bug[https://github.com/electron/electron/issues/16444] where different scaling factors of the main display will
		// cause windows to be created at the wrong size on other monitors when we call `new BrowserWindow`
		// After the electron bug gets resolved, we should retest and delete this line of code.
		this.win.setSize(this.myOpts.width, this.myOpts.height);

		if (this.myOpts.icon) {
			await downloadCache({
				fileName: `${this.myOpts.taskbarIconGroup}-taskbarIcon.png`,
				fromPath: this.myOpts.icon,
			}, (err, res) => {
				if (err) logger.error(`Fail to download taskbar icon: ${err} `);
				if (res) {
					this.win.setIcon(res);
				}
			});
			// this.win.setIcon(this.myOpts.icon);
		}
		// Store all of our windows in a global so they can be used across the application

		// @todo check if we are going to keep using windowStore
		// or switch to something else to keep reference of params
		windowStore.setParams(this.windowName, this.originalParams);
		// Store all of our windows in a global so they can be used across sea.
		this.id = this.win.id;
		this.details = this.myOpts;


		this.setupWindowEventListeners = this.setupWindowEventListeners.bind(this);
		this.customWindowEvents = this.customWindowEvents.bind(this);
		this.setupMainBusListeners = this.setupMainBusListeners.bind(this);

		this.setupWindowEventListeners();
		this.customWindowEvents();
		this.setupMainBusListeners();
		this.win.loadURL(this.url);

		// Convert the window names to electron webContentsIds.
		// This will prevent windows with the same name from accidentally
		// getting access to execJS
		// Was supposed to be a hack for small windows. Doesnt seem to work
		if (this.myOpts.height < 39) {
			this.win.once('ready-to-show', () => {
				// this.win.setSize(this.myOpts.width,this.myOpts.height);
			});
		}

		logger.log(`New browserwindow created: ${this.windowName}, ${this.win.id}, ${this.win.webContents.id}`);
	}

	/**
	 * make required preload directories
	 */
	makePreloadDirectories() {
		if (!fs.existsSync(cachePath)) {
			logger.log(`INITIAL SETUP: Creating preload directory:${cachePath}`);
			mkdirp.sync(cachePath);
		}

		if (!fs.existsSync(remoteModuleFolderPath)) {
			logger.log(`INITIAL SETUP: Creating remote module directory:${cachePath}`);
			mkdirp.sync(remoteModuleFolderPath);
		}
	}

	/**
	 * Download list of files, and write to preload cache
	 *
	 * @param {Object[]} fileList - list of files to download
	 */
	async downloadPreloadFiles(fileList) {
		if (!fileList) {
			return;
		}

		if (fileList && typeof fileList === 'string') {
			fileList = [{ url: fileList }];
		}
		const promises = fileList
			.filter(preload => isValidURL(preload.url))
			.map(preload => this.downloadPreloadFile(preload, remoteModuleFolderPath));
		const rawPreloadList = await Promise.all(promises);
		// filter out any empty preloads
		const preloadList = rawPreloadList.filter(p => !!p);
		// Save the preload parameter into global, so that the renderer will have access to it.
		// The preload list is then required in sea.js
		global.preload[this.windowName] = preloadList;
		this.preloadList = preloadList;
		logger.debug(`Downloaded preload files: ${stringify(preloadList)} `);
	}

	/**
	 * download a preload and write to remote module folder
	 *
	 * @param {Object} preload - preload file to download and write to disk
	 * @param {String} remoteModuleFolderPath - path to remote modules folder
	 */
	async downloadPreloadFile(preload, remoteModuleFolderPath) {
		const fileName = path.basename(preload.url);

		if (!preload.url) {
			return;
		}
		const alreadyLoaded = global.preloadsLoaded[preload.url];
		if (alreadyLoaded) {
			// Make sure that if the file is already downloaded, it gets into the preload list.
			const preloadFilePath = global.preloadsLoaded[preload.url].localPath;
			return preloadFilePath;
		}
		logger.debug(`Downloading preload file: ${preload.url}`);
		const Cookie = await getCookieHeader(session.defaultSession, new URL(preload.url).hostname);
		const downloadOptions = {};
		if (Cookie) {
			downloadOptions.headers = {
				Cookie,
			};
		}
		try {
			const preloadFileData = await download(preload.url, downloadOptions);
			const preloadFilePath = path.join(remoteModuleFolderPath, fileName);
			fs.writeFileSync(preloadFilePath, preloadFileData);

			global.preloadsLoaded[preload.url] = {
				url: preload.url,
				localPath: preloadFilePath
			};
			logger.log(`preloadFile downloaded: ${fileName} `);
			return preloadFilePath;
		} catch (err) {
			logger.error(`Error downloading preloadFile: ${fileName} `);
		}
	}
};
