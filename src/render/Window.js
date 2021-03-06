const EventEmitter = require('events').EventEmitter;
const { ipcRenderer } = require('electron');
const RequestHelper = require('./RequestHelper');
const { accessDenied, checkAndLogAccessDenied } = require('./common');
const uuidV4 = require('uuid/v4');
const logger = require('../logger/')();
const stringify = require('../common/helpers/safeStringify');
const WindowProcess = require('./WindowProcess')

let hasPollingListener = false;

class Window extends EventEmitter {
	/**
	 * @param {MainWindowParams} params
	 * @param {Function} cb
	 */
	constructor(params, cb = Function.prototype) {
		super();
		this.appUUID = params.appUUID;
		this.name = params.windowName || params.name || 'testname';
		this.responses = {};
		this.spawnCallback = cb;
		this.bindAllFunctions()

		// Make sure the polling listener is only added once per window. It needs to be added to application windows which come in
		// with dontSpawn: true, so the listener needs to be setup before we get to actual window creation.
		if (!hasPollingListener) {
			hasPollingListener = true;
			this.beginPollingListener.call(this);
		}
		// FIXME[Terry, Ryan, Erik] closeRequestedListeners should be moved to the main process. Currently, only closeRequested listeners from the current window are kept track
		this.closeRequestedListeners = [];

		// If we're just trying to get a reference to a window
		if (params.dontSpawn) {
			this.uuid = params.id;
			ipcRenderer.on(`windowEvent-${this.name}`, this.remoteEvents.bind(this));
			return cb(this);
		}

		logger.verbose(`Creating a new Window from the sea API. ${stringify(params)}`);
		params.windowId = currentWindow.id;

		// Use spawnAs process to force the window into it's own process.
		if (params.spawnAs === 'process') {
			params.affinity = uuidV4();
		}
		// If we're creating a new window with a different appid we need to make a special call.
		if (params.affinity) {
			this.appUUID = params.affinity;
			params.uuid = params.affinity;
			params.appUUID = params.affinity;
			// we need to send this to the windowProcess manager since this windowProcess may not exist.
			return RequestHelper.sendRequest({ topic: 'createWindowWithAffinity', data: params }, this.onSpawnWithAffinityComplete.bind(this), cb);
		}

		RequestHelper.sendRequest({ topic: `${currentWindow.appUUID}-spawn`, data: params });
		// @todo why is this in a timeout?
		setTimeout(() => {
			logger.debug(`Window ${this.name}: spawn complete`);
			this.onSpawnComplete();
		}, 1);
	}

	bindAllFunctions() {
		const self = this;
		for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(self))) {
			const method = self[name];
			// skip constructor
			if (!(method instanceof Function) || method === Window) continue;
			self[name] = self[name].bind(self);
		}
	}

	/**
	 * Add a listener to begin polling resources
	 * Sends request to send the beginPollingResources request if polling has already begun
	 */
	beginPollingListener() {
		ipcRenderer.on('beginPollingResources', this.beginPollingResources.bind(this));
		RequestHelper.sendRequest({ topic: 'startPollingCheck', data: this.appUUID });
	}

	/**
	 * Begin polling cpu and memory information used by the windowProcess.
	 * Immediately send the first measurement.
	 */
	beginPollingResources() {
		// Delete the interval and set it again if it already exists
		// This can happen when a window hangs and causes all other windows in the same event loop to stop polling
		// On recovery the interval needs to be recreated or the windows won't properly send data.
		if (this.resourcePoller) {
			clearInterval(this.resourcePoller);
		}
		this.sendResourceUsage();
		this.resourcePoller = setInterval(this.sendResourceUsage.bind(this), 1000);
		ipcRenderer.on('stopPollingResources', this.stopPollingResources.bind(this));
		ipcRenderer.removeAllListeners('beginPollingResources');
	}

	/**
	 * stop retrieving cpu and memory information in use by the application.
	 *
	 * @returns undefined
	 */
	stopPollingResources() {
		clearInterval(this.resourcePoller);
		ipcRenderer.removeAllListeners('stopPollingResources');
		this.beginPollingListener();
	}

	/**
	 * Send memory and cpu usage to main process.
	 * Note that in sandbox mode only part of the process api is exposed.
	 * For cpu and memory the functions used below are the only allowed way to access this datas
	 */
	async sendResourceUsage() {
		const cpuUsage = process.getCPUUsage().percentCPUUsage;

		// get the process memory usage and convert it to KB
		const memUsage = await process.getProcessMemoryInfo();
		const memUsageRSS = memUsage.residentSet * 1024;

		const topic = `${currentWindow.appUUID}-resourceUpdate`;
		const data = { cpuUsage, memUsageRSS };
		RequestHelper.sendRequest({ topic, data, });
	}

	/**
	 *
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	onSpawnWithAffinityComplete(eventObject, data) {
		this.uuid = data.windowName;
		ipcRenderer.on(`windowEvent-${this.uuid}`, this.remoteEvents.bind(this));
		eventObject.cb(null, this);
	}

	onSpawnComplete() {
		ipcRenderer.on(`windowEvent-${this.uuid}`, this.remoteEvents.bind(this));
		if (this.spawnCallback) return this.spawnCallback(null, this);
	}

	/**
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	addEventListener(eventName, listener) {
		this.addListener(eventName, listener);
	}

	/**
	 * Adds listeners for events if permitted
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	addListener(eventName, listener) {
		const permission = `Window.addListener.${eventName}`;
		RequestHelper.sendRequest({ topic: 'checkPermission', data: permission }, (eventObject, isAllowed) => {
			if (isAllowed) {
				if (eventName == 'close-requested') {
					this.closeRequestedAdd(listener);
				}
				RequestHelper.addListener(`windowEvent-${this.name}.${eventName}`, listener);
			} else {
				logger.warn(`PERMISSION DENIED: Attempted to add listener on Window.${this.name}.${eventName}.`);
			}
		});
	}

	/**
	 *
	 * @param {Function} cb
	 */
	blur(cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-blur`, data: sendObject }, this.blurResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	bringToFront(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-bringToFront`, data: sendObject }, this.bringToFrontResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {boolean} force
	 * @param {Function} cb
	 */
	close(force = false, cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name, force };
		RequestHelper.sendRequest({ topic: `Window-${this.name}-close`, data: sendObject }, this.closeResponse.bind(this), cb);
	}

	/**
	 * If a developer has requested a close-requested event then we disable automatic closing of the window.
	 * @param {Function} listener
	 */
	closeRequestedAdd(listener) {
		// If we've never done this before, we need to let the main proc know to hold up the close process for a
		// window. If we have, we can just add this listener to our existing list.
		if (this.closeRequestedListeners.length === 0) {
			RequestHelper.sendRequest({ topic: `${this.name}-closeRequestedAdd` }, (eventObject, data) => {
				/** Would be nice to know _who_ added the closeRequested event. */
				if (!checkAndLogAccessDenied(data)) logger.debug(`${this.name}-closeRequestedAdd`);
			});
		}
		this.closeRequestedListeners.push(listener);
	}

	/**
	 *
	 * @param {Function} listener
	 */
	closeRequestedRemove(listener) {
		const i = this.closeRequestedListeners.indexOf(listener);
		if (i > -1) this.closeRequestedListeners.splice(i, 1);
		if (this.closeRequestedListeners.length === 0) {
			RequestHelper.sendRequest({ topic: `${this.name}-closeRequestedRemove` }, (eventObject, data) => {
				if (!checkAndLogAccessDenied(data)) logger.debug(`${this.name}-closeRequestedRemove`);
			});
		}
	}

	/**
	 *
	 * @param {String} script
	 * @param {Function} cb
	 */
	executeJavaScript(script, cb) {
		const sendObject = { id: this.uuid, name: this.name, script };
		logger.debug('executeJavaScript called on', this.name, stringify(script));
		RequestHelper.sendRequest({ topic: `${this.name}-executeJavaScript`, data: sendObject }, this.executeJavaScriptResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	focus(cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-focus`, data: sendObject }, this.focusResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getBounds(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-getBounds`, data: sendObject }, this.getBoundsResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getBoundsFromSystem(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-getBoundsFromSystem`, data: sendObject }, this.getBoundsFromSystemResponse.bind(this), cb);
	}

	/**
	 * @return {BrowserWindow}
	 */
	static getCurrent() {
		return currentWindow;
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getOptions(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-getDetails`, data: sendObject }, this.optionsResponse.bind(this), cb);
	}

	/**
	 * @return {RenderApplication}
	 */
	getParentApplication() {
		return new WindowProcess({ uuid: this.appUUID, dontSpawn: true });
	}

	/**
	 *
	 * @param {Function} cb
	 */
	hide(cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-hide`, data: sendObject }, this.hideResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	isShowing(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-isShowing`, data: sendObject }, this.isShowingResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	minimize(cb = Function.prototype) {
		const sendObject = { type: 'window', id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-minimize`, data: sendObject }, this.minimizeResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	removeEventListener(eventName, listener) {
		this.removeListener(eventName, listener);
	}

	/**
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	removeListener(eventName, listener) {
		if (eventName == 'close-requested') {
			this.closeRequestedRemove(listener);
		}
		RequestHelper.removeListener(`windowEvent-${eventName}`, listener);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	restore(cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-restore`, data: sendObject }, this.restoreResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Number} left
	 * @param {Number} top
	 * @param {Number} width
	 * @param {Number} height
	 * @param {Function} cb
	 */
	setBounds(left, top, width, height, cb) {
		const bounds = {
			x: left,
			y: top,
			width,
			height
		};
		const sendObject = {
			type: 'window', bounds, id: this.uuid, name: this.name
		};
		RequestHelper.sendRequest({ topic: `${this.name}-setBounds`, data: sendObject }, this.setBoundsResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	show(cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name };
		RequestHelper.sendRequest({ topic: `${this.name}-show`, data: sendObject }, this.showResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Number} left
	 * @param {Number} top
	 * @param {boolean} force
	 * @param {Function} cb
	 */
	showAt(left, top, force, cb = Function.prototype) {
		const sendObject = {
			id: this.uuid, name: this.name, left, top
		};
		RequestHelper.sendRequest({ topic: `${this.name}-showAt`, data: sendObject }, this.showAtResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {Object} options
	 * @param {Function} cb
	 */
	updateOptions(options, cb = Function.prototype) {
		const sendObject = { id: this.uuid, name: this.name, options };
		RequestHelper.sendRequest({ topic: `${this.name}-updateOptions`, data: sendObject }, this.updateOptionsResponse.bind(this), cb);
	}

	/**
	 *
	 * @param {String} uuid
	 * @param {String} windowName
	 */
	static fromNameAndUUID(uuid, windowName) {
		logger.verbose(`Retrieving window ${windowName || uuid}`);
		const newWin = new Window({
			type: 'window', id: uuid, windowName, dontSpawn: true
		});
		return newWin;
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	blurResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		const { cb } = eventObject;
		if (cb && typeof cb === 'function') {
			cb(data);
		} else {
			return logger.warn(`blurResponse callback provided is not a function: ${typeof eventObject.cb} provided.`);
		}
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	bringToFrontResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	closeResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	executeJavaScriptResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	focusResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		const { cb } = eventObject;
		if (cb && typeof cb === 'function') {
			cb(data);
		} else {
			return logger.warn(`focusResponse callback provided is not a function: ${typeof eventObject.cb} provided.`);
		}
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	getBoundsResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		return eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	getBoundsFromSystemResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		return eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	hideResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	isShowingResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	minimizeResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	optionsResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {ElectronEvent} event
	 * @param {Object} data
	 */
	remoteEvents(event, data) {
		this.emit(data.topic, data.data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	restoreResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	setBoundsResponse(eventObject, data) {
		if (data.bounds) {
			data.bounds.left = data.bounds.x;
			data.bounds.top = data.bounds.y;
		}
		const error = checkAndLogAccessDenied(data);
		if (error) {
			return eventObject.cb(data);
		}
		return eventObject.cb(data.bounds);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	showAtResponse(eventObject, data) {
		const error = checkAndLogAccessDenied(data);
		if (error) {
			return eventObject.cb(data);
		}
		eventObject.cb();
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	showResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	updateOptionsResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {*} event
	 * @param {Object} data
	 */
	windowResponses(event, data) {
		if (this.responses[data.responseUUID]) {
			logger.debug(`Window response: ${this.responses[data.responseUUID]}`);
			this.responses[data.responseUUID].functionCB(this.responses[data.responseUUID], data);
		}
	}
}

const requestObject = {
	topic: 'syncWindowInfo',
};
const response = ipcRenderer.sendSync('sea.mainRequest', requestObject);
let currentWindow = new Window({
	dontSpawn: true, id: response.uuid, appUUID: response.uuid, windowName: response.windowName
});

module.exports = Window;
