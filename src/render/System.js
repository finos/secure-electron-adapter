const { ipcRenderer, dialog } = require('electron');
const EventEmitter = require('events').EventEmitter;
const RequestHelper = require('./RequestHelper');
const { checkAndLogAccessDenied } = require('./common');
const logger = require('../logger/')();
const MessageBus = require('./MessageBus');


class System extends EventEmitter {
	
	/**
	 *
	 * @param {RenderSystemParams} params
	 */
	constructor() {
		super();

		this.MessageBus = MessageBus;

		// todo move aliases outside of the constructor and into the class...
		this.addEventListener = (topic, handler) => {
			this.addListener(topic, handler);
		};
		this.removeEventListener = (topic, handler) => {
			this.removeListener(topic, handler);
		};
		ipcRenderer.on('systemEvent', this.remoteSystemEvents.bind(this));

		this.bindAllFunctions();
	}

	bindAllFunctions() {
		const self = this;
		for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(self))) {
			const method = self[name];
			// skip constructor
			if (!(method instanceof Function) || method === System) continue;
			self[name] = self[name].bind(self);
		}
	}

	/**
	 * Adds listeners for events if permitted
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	addListener(eventName, listener) {
		const permission = `System.addListener.${eventName}`;
		RequestHelper.sendRequest({ topic: 'checkPermission', data: permission }, (eventObject, isAllowed) => {
			if (isAllowed) {
				RequestHelper.addListener(`systemEvent.${eventName}`, listener);
				logger.verbose(`Added listener: systemEvent.${eventName}`);
			} else {
				logger.warn(`PERMISSION DENIED: Attempted to add listener on SystemEvent.${eventName}.`);
			}
		});
	}

	/**
	 *
	 * @param {Object} data
	 * @return undefined
	 */
	clearCache(data) {
		RequestHelper.sendRequest({ topic: 'clearCache', data }, (eventObject, response) => {
			checkAndLogAccessDenied(response);
		});
	}

	/**
	 * @return undefined
	 */
	exit() {
		return RequestHelper.sendRequest({ topic: 'exit', data: null }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
		});
	}

	/**
	 * @return undefined
	 */
	flushStorage() {
		return RequestHelper.sendRequest({ topic: 'flushStorage' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
		});
	}

	getAllWindowProcesses(cb) {
		return RequestHelper.sendRequest({ topic: 'getAllWindowProcesses' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
	}

	/**
	 * @return undefined
	 */
	getAllWindows() {
		return RequestHelper.sendRequest({ topic: 'getAllWindows' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		});
	}

	/**
	 * Gets the value of system environment variable(s)
	 * @param {*} variableName either a string or an array of strings for the environment variable name(s) needed
	 * @param {*} successCallback called when the function succeeds, regardless of whether the environment variable(s) exist.
	 * If a string was passed, then the value of the variable name is passed to the function, or `null` if it does not exist.
	 * If an array of strings was passed, then an object with the variable names as properties is returned.  Non-existent variables
	 * will be `null`.
	 * @param {*} errorCallback called when the environment variable lookup failed.
	 */
	getEnvironmentVariable(variableName, successCallback = Function.prototype, errorCallback = Function.prototype) {
		return RequestHelper.sendRequest({ topic: 'getEnvironmentVariable', data: { variableName } }, (eventObject, data) => {
			// If an error was returned by the main process, invoke the error callback.
			// An error means that environment variables couldn't even be accessed
			if (data.status === 'error') {
				logger.error(`getEnvironmentVariable Error: ${data.message}`);
				errorCallback(data);
			} else {
				logger.debug('getEnvironmentVariable response received.');
				eventObject.cb(data.value);//this could be null if the env variable didn't exist -- that's allowed
			}
		}, successCallback);//the successCallback becomes eventObject.cb
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getSystemInfo(cb) {
		return RequestHelper.sendRequest({ topic: 'getSystemInfo' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getMonitorInfo(cb) {
		return RequestHelper.sendRequest({ topic: 'getMonitorInfo' }, (eventObject, data) => {
			const error = checkAndLogAccessDenied(data);
			if (error) {
				eventObject.cb(data);
			} else {
				eventObject.cb(data);
				logger.verbose('getMonitorInfo request sent.');
			}
		}, cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getMousePosition(cb) {
		return RequestHelper.sendRequest({ topic: 'getMousePosition' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getProcessList(cb) {
		return RequestHelper.sendRequest({ topic: 'getProcessList', data: {} }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
	}

	/**
	 *
	 * @param {Function} cb
	 */
	getVersion(cb) {
		return RequestHelper.sendRequest({ topic: 'getVersion' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(process.versions);
		}, cb);
	}

	sendNotification(params) {
		RequestHelper.sendRequest({ topic: 'notification', data: params }, (event, response) => {
			checkAndLogAccessDenied(response);
		});
	}

	/**
	 * Should be called once from startup application specified in manifest.main.url to confirm it has started
	 *
	 */
	startupApplicationHandshake() {
		return RequestHelper.sendRequest({ topic: 'startupApplicationHandshake' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, Function.prototype);
	}

	/**
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 */
	removeListener(eventName, listener) {
		RequestHelper.removeListener(`systemEvent.${eventName}`, listener);
	}

	/**
	 *
	 * @param {ElectronEvent} event
	 * @param {Object} data
	 */
	remoteSystemEvents(event, data) {
		this.emit(data.event, data.data);
	}

	/**
	 *
	 * @param {String} uuid
	 * @param {String} name
	 */
	showDeveloperTools(uuid, name, cb = Function.prototype) {
		return RequestHelper.sendRequest({ topic: `${name}-showDeveloperTools`, data: { uuid, name } }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			cb();
		});
	}
}

module.exports = System;
