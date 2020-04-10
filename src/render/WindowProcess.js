const { ipcRenderer } = require('electron');
const EventEmitter = require('events').EventEmitter;
const RequestHelper = require('./RequestHelper');
const Window = require('./Window');
const { checkAndLogAccessDenied } = require('./common');
const logger = require('../logger')();

const requestObject = {
	topic: 'syncAppInfo'
};

const currentWindowProcessResponse = ipcRenderer.sendSync('sea.mainRequest', requestObject);

class WindowProcess extends EventEmitter {
	/**
	 *
	 * @param {MainWindowProcessParams} params
	 * @param {Function} cb
	 */
	constructor(params, cb = Function.prototype) {
		super();
		this.name = params.name;
		this.ready = false;
		// The 'window' property refers to the Main WindowProcess's "appWindow".
		// This value is used inside of the SplinterAgentSlave to determine whether it should turn on its functionality
		this.window = currentWindowProcessResponse.window;
		this.uuid = params.uuid;
		this.bindAllFunctions();

		// params.dontSpawn indicates the creator of this object just wants a reference to an existing windowProcess
		// @todo long term we should probably make a static function like `getAppByUUID`.
		if (params.dontSpawn) {
			if (!this.ready) {
				this.ready = true;
				const event = new Event('windowProcessLoaded');
				window.dispatchEvent(event);
			}
			ipcRenderer.on(`windowProcessEvent-${this.uuid}`, this.remoteApplicationEvents.bind(this));
			return this;
		}

		// @todo wat. Why are we returning null here???? What are the consequences here?
		if (params.name === currentWindowProcessResponse.title) {
			return;
		}
		
		return RequestHelper.sendRequest({ topic: 'createWindowProcess', data: params }, this.onSpawnComplete.bind(this), cb);
	}


	bindAllFunctions() {
		const self = this;
		for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(self))) {
			const method = self[name];
			// skip constructor
			if (!(method instanceof Function) || method === WindowProcess) continue;
			self[name] = self[name].bind(self);
		}
	}

	/**
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
		const permission = `WindowProcess.addListener.${eventName}`;
		RequestHelper.sendRequest({ topic: 'checkPermission', data: permission }, (eventObject, isAllowed) => {
			if (isAllowed) RequestHelper.addListener(`windowProcessEvent-${this.uuid}.${eventName}`, listener);
		});
	}

	/**
	 * @todo support force closing (terminate?).
	 * @param {boolean} force currently unused
	 * @param {Function} cb
	 */
	close(force, cb) {
		const sendObject = { type: 'application', uuid: this.uuid };
		logger.log(`Render: close called for windowProcess ${this.uuid}`);
		RequestHelper.sendRequest({ topic: `WindowProcess-${this.uuid}-close`, data: sendObject }, this.onCloseResponse.bind(this), cb);
	}

	/**
	 * retrieve all child windows for this application
	 *
	 * @param {Function} cb
	 */
	async getWindows(cb) {
		const request = { topic: 'getWindows', data: { uuid: this.uuid } };
		const response = await RequestHelper.asyncSendRequest(request);
		const error = checkAndLogAccessDenied(response);
		if (error) {
			cb(response);
		}
		const allWindows = response.map(win => Window.fromNameAndUUID(win.uuid, win.windowName));
		cb(allWindows);
		return allWindows;
	}

	/**
	 *
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	onGetWindowsResponse(eventObject, data) {
		const windows = [];
		for (const w in data) {
			const win = data[w];
			const wrapped = Window.fromNameAndUUID(win.uuid, win.windowName);
			windows.push(wrapped);
		}
		eventObject.cb(windows);
	}

	async getManifest(cb) {
		const data = { type: 'application', uuid: this.uuid };
		const topic = `${this.uuid}-getManifest`;
		const request = { topic, data };
		const response = await RequestHelper.asyncSendRequest(request);
		checkAndLogAccessDenied(response);
		cb(response);
		return response;
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getTrayInfo(cb = Function.prototype) {
		RequestHelper.sendRequest({ topic: 'getTrayInfo', data: { uuid: this.uuid } }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
	}

	/**
	 *
	 * @param {String} type
	 * @param {Function} listener
	 */
	removeEventListener(type, listener) {
		this.removeListener(type, listener);
	}

	/**
	 *
	 * @param {String} type
	 * @param {Function} listener
	 */
	removeListener(type, listener) {
		RequestHelper.removeListener(`windowProcessEvent-${this.uuid}.${type}`, listener);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	removeTray(cb = Function.prototype) {
		RequestHelper.sendRequest({ topic: 'removeTray', data: { uuid: this.uuid } }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
		});
		cb();
	}

	/**
	 * restart this windowProcess
	 */
	restart() {
		RequestHelper.sendRequest({ topic: 'restartWindowProcess', data: { uuid: this.uuid } }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
		});
	}

	/**
	 * @todo: restrict to one icon.
	 *
	 * @param {String} iconpath
	 * @param {Function[]} listeners
	 * @param {Function} cb
	 *
	 * @return undefined
	 */
	setTray(iconpath, listeners, cb = Function.prototype) {
		const trayListeners = listeners;
		RequestHelper.sendRequest({ topic: 'setTray', data: { iconpath, uuid: this.uuid, listeners: listeners ? Object.keys(listeners) : {} }, persistChannel: true }, (eventObject, data) => {
			const error = checkAndLogAccessDenied(data);
			if (!error && listeners && listeners.clickListener && data.event == 'click') {
				logger.debug('setTray request sent');
				listeners.clickListener(data);
			}
		});
		cb();
	}

	/**
	 *
	 * @param {String} uuid
	 * @return {WindowProcess}
	 */
	static fromUUID(uuid) {
		return new WindowProcess({ uuid, dontSpawn: true });
	}

	/**
	 * @private
	 * returns instance of our current application
	 */
	static getCurrent() {
		return currentApplication;
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	gotDetails(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
		logger.debug('gotDetails request sent');
	}

	/**
	 * @private
	 * @param {Function} cb
	 * This function sends a request but no one is listening to it on the main process side.
	 */
	getOptions(cb) { 
		const sendObject = { type: 'application', id: this.uuid };
		RequestHelper.sendRequest({ topic: 'getDetails', data: sendObject }, this.gotDetails.bind(this), cb);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	onCloseResponse(eventObject, data) {
		checkAndLogAccessDenied(data);
		eventObject.cb(data);
	}

	/**
	 * @private
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} details
	 */
	onSpawnComplete(eventObject, details) {
		const error = checkAndLogAccessDenied(details);
		if (error) {
			logger.error('onSpawnComplete', error);
			eventObject.cb(details);
		} else {
			this.uuid = details.windowProcessUUID;
			this.name = details.name;
			if (!this.ready) {
				this.ready = true;
				const event = new Event('windowProcessLoaded');
				window.dispatchEvent(event);
			}
			ipcRenderer.on(`windowProcessEvent-${this.uuid}`, this.remoteApplicationEvents.bind(this));
			eventObject.cb(null, this);
		}
	}

	/**
	 * @private
	 * @param {ElectronEvent} event
	 * @param {Object} data
	 */
	remoteApplicationEvents(event, data) {
		logger.debug('remote event log', event, data);
		this.emit(data.event, data.data);
	}
}

// The currentApplication is an object returned from sea.getCurrentWindowProcess().
// It represents a 'wrap' of the main process that this window sits inside of.
let currentApplication = new WindowProcess({
	name: currentWindowProcessResponse.name,
	dontSpawn: true,
	id: currentWindowProcessResponse.browserWindowId,
	uuid: currentWindowProcessResponse.uuid
});

module.exports = WindowProcess;
