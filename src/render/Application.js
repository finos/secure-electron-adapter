const { ipcRenderer } = require('electron');
const currentWindow = require('electron').remote.getCurrentWindow();
const EventEmitter = require('events').EventEmitter;
const RequestHelper = require('./RequestHelper');
const Window = require('./Window');
const { accessDenied, checkAndLogAccessDenied } = require('../common/helpers');
const logger = require('../logger/')();

if (!currentWindow) {
	logger.error('electron.remote.getCurrentWindow() is undefined');
}
const requestObject = {
	topic: 'syncAppInfo',
	data: { id: currentWindow.id },
};

const currentApplicationResponse = ipcRenderer.sendSync('e2o.mainRequest', requestObject);

class Application extends EventEmitter {
	/**
	 *
	 * @param {MainApplicationParams} params
	 * @param {Function} cb
	 */
	constructor(params, cb = Function.prototype) {
		super();
		this.name = params.name;
		this.ready = false;
		// The 'window' property refers to the Main Application's "appWindow", or its 'main window' in OF parlance.
		// This value is used inside of the SplinterAgentSlave to determine whether it should turn on its functionality
		this.window = currentApplicationResponse.window;
		this.uuid = params.uuid;

		// params.dontSpawn indicates the creator of this object just wants a reference to an existing application
		// @todo long term we should probably make a static function like `getAppByUUID`.
		if (params.dontSpawn) {
			if (!this.ready) {
				this.ready = true;
				const event = new Event('applicationLoaded');
				window.dispatchEvent(event);
			}
			ipcRenderer.on(`applicationEvent-${this.uuid}`, this.remoteApplicationEvents.bind(this));
			return this;
		}

		// @todo wat. Why are we returning null here???? What are the consequences here?
		if (params.name === currentWindow.getTitle()) {
			return;
		}

		return RequestHelper.sendRequest({ topic: 'createApplication', data: params }, this.onSpawnComplete.bind(this), cb);
	}

	/**
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	addEventListener(eventName, listener) {
		this.addListener(eventName, listener);
	}

	/**
	 * Adds listeners for OpenFin events if permitted
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	addListener(eventName, listener) {
		const permission = `Application.addListener.${eventName}`;
		RequestHelper.sendRequest({ topic: 'checkPermission', data: permission }, (eventObject, isAllowed) => {
			if (isAllowed) RequestHelper.addListener(`applicationEvent-${this.uuid}.${eventName}`, listener);
		});
	}

	/**
	 * @todo support force closing (terminate?).
	 * @param {boolean} force currently unused
	 * @param {Function} cb1
	 * @param {Function} cb2  currently unused
	 */
	close(force, cb1, cb2) {
		const sendObject = { type: 'application', uuid: this.uuid };
		logger.log(`Render: close called for application ${this.uuid}`);
		RequestHelper.sendRequest({ topic: `Application-${this.uuid}-close`, data: sendObject }, this.onCloseResponse.bind(this), cb1);
	}

	createFromManifest(manifestUrl, callback, errorCallback) {
		logger.error('Unimplemented method: createFromManifest');
	} // unimplemented

	/**
	 * retrieve all child windows for this application
	 *
	 * @param {Function} cb
	 */
	async getChildWindows(cb) {
		const request = { topic: 'getChildWindows', data: { uuid: this.uuid } };
		const response = await RequestHelper.asyncSendRequest(request);
		const error = checkAndLogAccessDenied(response);
		if (error) {
			cb(response);
		}
		const wrappedWindows = response.map(win => Window.wrap(win.uuid, win.windowName));
		cb(wrappedWindows);
		return wrappedWindows;
	}

	/**
	 *
	 * @param {RequestHelperEventObject} eventObject
	 * @param {Object} data
	 */
	onGetChildWindowsResponse(eventObject, data) {
		const windows = [];
		for (const w in data) {
			const win = data[w];
			const wrapped = Window.wrap(win.uuid, win.windowName);
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
	getTrayIconInfo(cb = Function.prototype) {
		RequestHelper.sendRequest({ topic: 'getTrayIconInfo', data: { uuid: this.uuid } }, (eventObject, data) => {
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
		RequestHelper.removeListener(`applicationEvent-${this.uuid}.${type}`, listener);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	removeTrayIcon(cb = Function.prototype) {
		RequestHelper.sendRequest({ topic: 'removeTrayIcon', data: { uuid: this.uuid } }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
		});
		cb();
	}

	/**
	 * restart this application
	 */
	restart() {
		RequestHelper.sendRequest({ topic: 'restartApplication', data: { uuid: this.uuid } }, (eventObject, data) => {
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
	setTrayIcon(iconpath, listeners, cb = Function.prototype) {
		const trayIconListeners = listeners;
		RequestHelper.sendRequest({ topic: 'setTrayIcon', data: { iconpath, uuid: this.uuid, listeners: listeners ? Object.keys(listeners) : {} }, persistChannel: true }, (eventObject, data) => {
			const error = checkAndLogAccessDenied(data);
			if (!error && listeners && listeners.clickListener && data.event == 'click') {
				logger.debug('setTrayIcon request sent');
				listeners.clickListener(data);
			}
		});
		cb();
	}

	/**
	 *
	 * @param {String} uuid
	 * @return {RenderApplication}
	 */
	static wrap(uuid) {
		return new Application({ uuid, dontSpawn: true });
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
	getOptions(cb) { // this should be the window descr not the openfin manifest
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
			this.uuid = details.applicationUUID;
			this.name = details.name;
			if (!this.ready) {
				this.ready = true;
				const event = new Event('applicationLoaded');
				window.dispatchEvent(event);
			}
			ipcRenderer.on(`applicationEvent-${this.uuid}`, this.remoteApplicationEvents.bind(this));
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

	getZoomLevel(callback, errorCallback) {
		logger.error('Unimplemented method: Application.getZoomLevel');
	}

	// unimplemented
	getGroups(callback, errorCallback) {
		logger.error('Unimplemented method: Application.getGroups');
	}

	// unimplemented
	getInfo(callback, errorCallback) {
		logger.error('Unimplemented method: Application.getInfo');
	}

	// unimplemented
	getParentUuid(callback, errorCallback) {
		logger.error('Unimplemented method: Application.getParentUUid');
	}

	// unimplemented
	getShortcuts(callback, errorCallback) {
		logger.error('Unimplemented method: Application.getShortcuts');
	}

	// unimplemented
	isRunning(callback, errorCallback) {
		logger.error('Unimplemented method: Application.isRunning');
	}

	// unimplemented
	registerUser(userName, appName, callback, errorCallback) {
		logger.error('Unimplemented method: Application.registerUser');
	}

	// unimplemented
	run() {
		logger.error('Unimplemented method: Application.run');
	}

	// unimplemented
	scheduleRestart(callback, errorCallback) {
		logger.error('Unimplemented method: Application.scheduleRestart');
	}

	// unimplemented
	setShortcuts(config, callback, errorCallback) {
		logger.error('Unimplemented method: Application.setShortcuts');
	}

	// unimplemented
	setZoomLevel(callback, errorCallback) {
		logger.error('Unimplemented method: Application.setZoomLevel');
	}

	// unimplemented
	terminate(callback, errorCallback) {
		logger.error('Unimplemented method: Application.terminate');
	}
}

// The currentApplication is an object returned from fin.desktop.Application.getCurrent().
// It represents a 'wrap' of the main application that this window sits inside of.
let currentApplication = new Application({
	name: currentApplicationResponse.name,
	dontSpawn: true,
	id: currentWindow.id,
	uuid: currentApplicationResponse.uuid
});

module.exports = Application;
