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

const allWindows = {};
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
	 * create a new wrap creates a window.
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
		this.closeRequested = false; // Toggles to true when Finsemble has registered a "close-requested" event. When this is true, automatic window closes are disabled.
		params.backgroundColor = undefined;
		this.url = params.url;
		this.customData = params.customData || {};
		if (params.mainWindowOptions && params.mainWindowOptions.customData) {
			this.customData = params.mainWindowOptions.customData;
		}
		this.permissions = params.permissions;
		this.finsembleDomain = params.finsembleDomain;
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
			show: params.autoShow || false,
			icon: params.icon,
			title: params.name,
			frame: params.frame,
			skipTaskbar: params.showTaskbarIcon === false,
			autoHideMenuBar: true,
			webPreferences: {
				webSecurity: true,
				nodeIntegration: false,
				contextIsolation: false,
				sandbox: true,
				affinity: MainWindow._getAffinityForWindow(params, this.appUUID),
				preload: path.join(__dirname, '../../dist', 'e2o.js'), // Preload e2o.js. All other preloads are done in e2o.js
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
			finsembleDomain: this.finsembleDomain
		});
		await this.downloadPreloadFiles(trustedPreloads);
		// Make sure all preloads are downloaded, then create an Electron Window
		await this.createBrowserWindow();

		// Set disable zoom for all windows according to default window options
		if (defaultWindowOptions.webPreferences.disableZoom) {
			const { webContents } = this.win;
			webContents.on('did-finish-load', () => {
				webContents.setZoomFactor(1);
				webContents.setVisualZoomLevelLimits(1, 1);
				webContents.setLayoutZoomLevelLimits(0, 0);
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
		this.mouseUp = this.mouseUp.bind(this);
		this.mouseDown = this.mouseDown.bind(this);
		this.moveEvent = this.moveEvent.bind(this);
		this.resizeEvent = this.resizeEvent.bind(this);
		this.convertBoundsInfo = this.convertBoundsInfo.bind(this);
		this.getBounds = this.getBounds.bind(this);
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
		this.disableFrame = this.disableFrame.bind(this);
		this.enableFrame = this.enableFrame.bind(this);
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
	 * Converts electron bounds into bounds that finsemble can use. The key difference is that
	 * electron uses x/y, and finsemble uses left/top.
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

					// When a window is of type "application", some events will be handled on both the Window and the Application.
					// For now, we only handle this discrepency on the close event because it causes an error.
					// The error happens because we try to check permissions on the window, but it's already been closed by the application shutting down.
					// The code below just adds a prefix so that the application and window receive seperate events.
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
	 * any window event listeners that don't follow the base case handled in `setupWindowEventListeners`
	 */
	customWindowEvents() {
		// @todo this drives me bananas. LOOK AT ALL OF THESE ANONYMOUS EVENT HANDLERS.
		if (this.win.hookWindowMessage) {
			// When the window's ENTERSIZEMOVE event is thrown, we will call 'mouseDown'.
			this.win.hookWindowMessage(WINAPI.WM_ENTERSIZEMOVE, this.mouseDown);
			// When the window's EXITSIZEMOVE event is thrown, we will call 'mouseUp'.
			this.win.hookWindowMessage(WINAPI.WM_EXITSIZEMOVE, this.mouseUp);
		} else {
			console.error('BrowserWindow.hookWindowMessage is undefined.  Finsemble is running in an experimental state that will not be fully functional.');
		}

		// This event is thrown before electron proceeds with a resize or move event.
		// This allows us to intercept the move request and choose to move the window somewhere else.
		this.win.on('will-resize', (event, newBounds) => { this.resizeEvent(event, newBounds); });
		this.win.on('will-move', (event, newBounds) => { this.moveEvent(event, newBounds); });

		// this.win.on("resize", (event) => { this.sendEventToWindows("disabled-frame-bounds-changed"); });

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
			// Get rid of all subscribers so if a window with the same name is reincarnated, FEA won't blow up.
			MainBus.unsubscribeWindow(this.windowName)
			this.removeAPIHandlers();
			windowStore.delete(this.windowName);
			// This is a poorly chosen event name. At this point, MainApplication will handle its cleanup of this window.
			this.emit('close', this.windowName);
			this.sendEventToWindows('closed', { name: this.windowName });
		});
	}

	/**
	 * Changes the 'closeRequested' boolean. This is a vlaue that changes the way the window closes.
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
		MainBus.sendEvent(`applicationEvent-${this.appUUID}.${event}`, data);
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
	 * disabled-frame-bounds-changing requires a different format for bounds info
	 */
	getBoundsEventInfo() {
		if (!this.location) return;
		const mouseLocation = electron.screen.getCursorScreenPoint();

		// Here we are using the mouse location + an offset because the bounds emitted by the will-move event
		// are wrong and cause the window to violently jerk in the general direction of the user's
		// mouse movment. This custom left/top enables smooth movement.
		const left = Number(mouseLocation.x) - Number(this.movingObj.mouseOffset.left);
		const top = Number(mouseLocation.y) - Number(this.movingObj.mouseOffset.top);
		const height = Number(this.location.height);
		const width = Number(this.location.width);
		const newLocation = {
			left,
			top,
			width,
			height,
			right: left + width,
			bottom: top + height,
		};

		newLocation.changeType = 0;
		newLocation.name = this.windowName;
		return newLocation;
	}

	/**
	 * Handle resize events
	 * @param {WindowEvent} event
	 * @param {WindowBounds} newBounds
	 */
	resizeEvent(event, newBounds) {
		// some other window is being resized. This one is likely being resized because it is docked.
		if (this.movable || (resizingWindow && resizingWindow != this.windowName)) {
			return;
		}
		event.preventDefault();

		// new bounds come unscaled. scale them:
		let point = { x: newBounds.x, y: newBounds.y };
		let scaledPoint = electron.screen.screenToDipPoint(point);

		point = { x: newBounds.x + newBounds.width, y: newBounds.y + newBounds.height };
		newBounds.x = Math.round(scaledPoint.x);
		newBounds.y = Math.round(scaledPoint.y);

		scaledPoint = electron.screen.screenToDipPoint(point);
		newBounds.right = Math.round(scaledPoint.x);
		newBounds.bottom = Math.round(scaledPoint.y);

		newBounds.width = newBounds.right - newBounds.x;
		newBounds.height = newBounds.bottom - newBounds.y;

		const currentWindowLocation = this.convertBoundsInfo(this.win.getBounds());

		// try to ascertain which edge(s) we are resizing from
		// these moves are really small so sometimes a corner move only shows a change on one side. Keep checking during move so that change isn't missed.
		if (Math.abs(currentWindowLocation.x - newBounds.x) >= 1 && !resizeEdges.includes('left')) {
			resizeEdges.push('left');
		}
		if (Math.abs(currentWindowLocation.y - newBounds.y) >= 1 && !resizeEdges.includes('top')) {
			resizeEdges.push('top');
		}
		if (Math.abs(currentWindowLocation.right - newBounds.right) >= 1 && !resizeEdges.includes('right')) {
			resizeEdges.push('right');
		}
		if (Math.abs(currentWindowLocation.bottom - newBounds.bottom) >= 1 && !resizeEdges.includes('bottom')) {
			resizeEdges.push('bottom');
		}
		// If we aren't actually resizing the window, we've gotten into this event errantly. Instead of
		// sending out bad bounds-changing events, end here.
		if (!resizeEdges.length) return;
		// @todo staticEdges is a global object for some reason. It is only used in this function.
		// good candidate for refactoring.
		staticEdges = currentWindowLocation;
		resizingWindow = this.windowName;
		if (this.lastResizeTime && (Date.now() - this.lastResizeTime < 10)) {
			// @todo can lodash.throttle be used here?
			// throttle
			// Prevents a ton of resize requests from pummeling the system.
			return;
		}

		this.lastResizeTime = Date.now();

		// Used on mouseUp to determine what information to send out.
		if (!this.isResizing) {
			this.isResizing = true;
		}

		// deal with rounding
		// This seems to be necessary to keep components from overlapping on snap.
		if (!resizeEdges.includes('left')) {
			newBounds.x = staticEdges.x;
		}
		if (!resizeEdges.includes('top')) {
			newBounds.y = staticEdges.y;
		}
		if (!resizeEdges.includes('right')) {
			newBounds.right = staticEdges.right;
		}
		if (!resizeEdges.includes('bottom')) {
			newBounds.bottom = staticEdges.bottom;
		}

		newBounds.height = newBounds.bottom - newBounds.y;
		newBounds.width = newBounds.right - newBounds.x;

		this.lastSizeMoveLoc = {
			left: newBounds.x,
			top: newBounds.y,
			height: newBounds.height,
			width: newBounds.width,
			changeType: 1,
		};

		// This event will bubble up inside of the DockableWindow in finsemble. There, we will determine
		// whether the user's intended move will be allowed to proceed, or if we should modify it
		// (e.g., snap it to another window or monitor).
		this.sendEventToWindows('disabled-frame-bounds-changing', this.lastSizeMoveLoc);
	}

	/**
	 * handle move events
	 * @param {} event
	 */
	moveEvent(event, newBounds) {
		if (this.movable || (movingWindow && movingWindow != this.windowName)) {
			// some other window is the primary mover. This one is likely being dragged around because it is docked.
			// console.log("some other window is being moved: ", movingWindow);
			return;
		}

		event.preventDefault();

		const now = Date.now();
		if (!movingWindow) {
			movingWindow = this.windowName;
		} else if (this.lastResizeTime && (now - this.lastResizeTime < 10)) { // throttle
			logger.verbose(`Throttled move: Now: ${now}, lastResizeTime: ${lastResizeTime}`);
			return;
		}

		if (!this.isMoving) {
			this.isMoving = true;
		}

		const mouseLocation = electron.screen.getCursorScreenPoint();
		// let currentWindowLocation = this.convertBoundsInfo(this.win.getBounds());

		// Here we are using the mouse location + an offset because the bounds emitted by the will-move event
		// are wrong and cause the window to violently jerk in the general direction of the user's
		// mouse movment. This custom left/top enables smooth movement.
		newBounds.x = Math.round(this.startMoveWindowLocation.x + mouseLocation.x - this.startMoveMouseLocation.x);
		newBounds.y = Math.round(this.startMoveWindowLocation.y + mouseLocation.y - this.startMoveMouseLocation.y);


		newBounds.width = this.startMoveWindowLocation.width;
		newBounds.height = this.startMoveWindowLocation.height;

		this.lastSizeMoveLoc = {
			left: newBounds.x,
			top: newBounds.y,
			height: newBounds.height,
			width: newBounds.width,
			changeType: 0,
		};

		// win7: fast mouse movement after mouse down sometimes has the mouse position
		// outside of the window bounds. Return to prevent cursor moving outside of window.
		if (mouseLocation.y < newBounds.y
			|| mouseLocation.y > newBounds.y + newBounds.height
			|| mouseLocation.x < newBounds.x
			|| mouseLocation.x > newBounds.x + newBounds.width
		) {
			return;
		}

		// uncomment the lines below for debugging.
		// console.log(this.startMoveWindowLocation, this.lastSizeMoveLoc);
		// console.log(this.lastSizeMoveLoc);

		// This event will bubble up inside of the DockableWindow in finsemble. There, we will determine
		// whether the user's intended move will be allowed to proceed, or if we should modify it
		// (e.g., snap it to another window or monitor).
		this.sendEventToWindows('disabled-frame-bounds-changing', this.lastSizeMoveLoc);
	}

	/**
	 * Track when the mouse is down so we know if the user initiated the move/resize event
	 * @param {WindowEvent} event
	 */
	mouseDown(event) {
		this.startMoveMouseLocation = electron.screen.getCursorScreenPoint();
		this.startMoveWindowLocation = this.convertBoundsInfo(this.win.getBounds());
	}

	/**
	 * Handle the mouse up event. If we're moving/resizing send out events and reset the window
	 * @param {WindowEvent} event
	 */
	mouseUp(event) {
		if (this.isMoving) {
			this.isMoving = false;
			// prevent jitter from bounds sent by docking not matching last bounds
			this.win.setBounds(this.location);
			this.sendEventToWindows('disabled-frame-bounds-changed', this.getBounds());
			movingWindow = null;
		}

		if (this.isResizing) {
			this.isResizing = false;
			// prevent jitter from bounds sent by docking not matching last bounds
			this.win.setBounds(this.location);
			this.sendEventToWindows('disabled-frame-bounds-changed', this.getBounds());
			resizingWindow = null;
			resizeEdges = [];
		}
	}

	/**
	 * Update the window options. Right now, actions only occur on three options
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
		if (!params) {
			logger.warn(`setBounds called with no bounds for window ${this.windowName}`);
			return;
		}
		const xMissing = !params.hasOwnProperty('x');
		const yMissing = !params.hasOwnProperty('y');
		const heightMissing = !params.hasOwnProperty('height');
		const widthMissing = !params.hasOwnProperty('width');

		if (xMissing || yMissing || widthMissing || heightMissing) {
			let errorMessage = 'The following properties are missing from setBounds: ';
			if (xMissing) errorMessage += 'x, ';
			if (yMissing) errorMessage += 'y, ';
			if (widthMissing) errorMessage += 'width, ';
			if (heightMissing) errorMessage += 'height';
			errorMessage += '.';
			logger.error(`${errorMessage} ${params} `);
			return;
		}

		// round everything -> assimilated windows are sending fractional bounds
		for (const i in params) {
			params[i] = Math.round(params[i]);
		}

		/**
		 * Hack. For some reason this must be called twice to work.
		 * @todo verify that this is still true. I do not think this is the case.
		 */
		this.win.setBounds(params);
		this.win.setBounds(params); // need to do this twice
		this.location = params;
		this.win.setSize(params.width, params.height);

		eventObj.respond(this.getBounds());
		return this.getBounds();
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
		try {
			if (!this.win.isDestroyed()) {
				if (allWindows[this.win.id]) {
					delete allWindows[this.win.id];
				}

				this.win.destroy();
			}
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
	 * Disable a windows frame. This makes it so a user cannot move the window. Movement must occur from setbounds while this is active. While disabled, window will emit `disabled-frame-bounds-changing` events.
	 * @param {BusEvent} eventObj
	 */
	disableFrame(eventObj) {
		logger.debug(`WINDOW LIFECYCLE: Disabling the frame for ${this.windowName}.`);
		this.movable = false;
		if (!this.win) {
			logger.warn(`DisableFrame failed because window is not defined: ${this.windowName} `);
			return;
		}
		eventObj.respond({ status: 'success' });
	}

	/**
	 * Sets the window back to user moveable
	 * @param {BusEvent} eventObj
	 */
	enableFrame(eventObj) {
		logger.debug(`WINDOW LIFECYCLE: Enabling the frame for ${this.windowName}.`);
		this.movable = true;
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
			this.win.webContents
				.executeJavaScript(eventObj.data.script, true, () => {
					logger.debug(`Execute javascrpt successful for window ${this.windowName}.`);
					eventObj.respond({ status: 'success' });
				});
		} else {
			const err = {
				status: 'error',
				code: 'access_denied',
				message: `executeJavaScript is only allowed if invoked upon child windows. Window ${senderOpts.name} did not create ${this.windowName}.`
			};
			eventObj.respond(err);
			logger.warn(`Execute javascrpt failed for window ${this.windowName}: {err.message}`);
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
					.applicationManager
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
			finsembleDomain, preloadsAllowed, fileList, trustedPreloads
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
				// If the user suppliedi a valid URL (url and filename won't be equal), we need to
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
			} else if (trustedPreloads.includes(url)
				// @deprecate filename in 4.0
				|| trustedPreloads.includes(fileName)
				|| MainWindow._isRequiredPreload(url, finsembleDomain)) {
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
			finsembleDomain: params.finsembleDomain,
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
	 * Checks if the preload is one required for Finsemble
	 * The filenames listed are considered trusted only if they come from the same domain as finsemble is running in
	 * @param {string} url
	 * @param {string} finsembleDomain
	 * @returns {boolean}
	 */
	static _isRequiredPreload(url, finsembleDomain) {
		const requiredPreloads = ['FSBL.js', 'windowTitleBar.js'];
		let currentURL;
		try {
			currentURL = new URL(url);
		} catch (err) {
			logger.error(`Preload will fail for ${url} because it is not valid url.`);
			return requiredPreloads.includes(url);
		}

		if (currentURL && currentURL.hostname === finsembleDomain) {
			for (const name of requiredPreloads) {
				const urlName = getFilenameFromURL(url);
				if (name === urlName) { return true; }
			}
		}
		return false;
	}

	/**
	 *
	 * If a window is specified to have windowType 'application' or 'OpenfinApplication', it should be isolated.
	 * This means that it cannot have an affinity. If this line is removed, FEA things that the window is both
	 * an application _and_ grouped with other windows in the same affinity. This causes all manner of strange bugs.
	 * The LauncherService in finsemble _should_ prevent this from happening. However, if someone bypasses
	 * the finsemble API and creates a new window via `new fin.desktop.Window(params)`,
	 * the code below fixes this strange state.
	 * @static
	 * @param {browserWindowOptions} params
	 * @param {string} applicationUUID
	 * @returns string
	 */
	static _getAffinityForWindow(params, applicationUUID) {
		let affinity = params.affinity || applicationUUID;

		// if the window is an 'application', it cannot have an affinity. Default to the appUUID.
		if (params.windowType && params.windowType.toLowerCase().includes('application')) {
			affinity = applicationUUID;
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

		// @todo can we reuse the 'objectPool' from finsemble?
		allWindows[this.win.id] = this.win;
		// @todo check if we are going to keep using windowStore
		// or switch to something else to keep reference of params
		windowStore.setParams(this.windowName, this.originalParams);
		// Store all of our windows in a global so they can be used across e2o.
		// TODO: We may want to find something better here instead of a global
		global.windows[this.win.id] = this.win;
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

		logger.log(`New browserwindow created: ${this.windowName} `);
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
		// The preload list is then required in e2o.js
		global.preload[this.windowName] = preloadList;
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
		const Cookie = await getCookieHeader(session.defaultSession);
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
