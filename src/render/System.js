const { ipcRenderer, remote } = require('electron');
const EventEmitter = require('events').EventEmitter;
const RequestHelper = require('./RequestHelper');
const { accessDenied, checkAndLogAccessDenied } = require('../common/helpers');
const logger = require('../logger/')();

const currentWindow = remote.getCurrentWindow();

class System extends EventEmitter {
	/**
	 *
	 * @param {RenderSystemParams} params
	 */
	constructor(params) {
		super();

		// todo move aliases outside of the constructor and into the class...
		this.addEventListener = (topic, handler) => {
			this.addListener(topic, handler);
		};
		this.removeEventListener = (topic, handler) => {
			this.removeListener(topic, handler);
		};
		this.currentWindow = currentWindow;
		ipcRenderer.on('systemEvent', this.remoteSystemEvents.bind(this));
	}

	/**
	 * Adds listeners for OpenFin events if permitted
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
		return RequestHelper.sendRequest({ topic: 'quit', data: null }, (eventObject, data) => {
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

	getAllApplications(cb) {
		return RequestHelper.sendRequest({ topic: 'getAllApplications' }, (eventObject, data) => {
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
	 *
	 * @param {Function} cb
	 */
	getHostSpecs(cb) {
		return RequestHelper.sendRequest({ topic: 'getHostSpecs' }, (eventObject, data) => {
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
				eventObject.cb(data.monitorInfo);
				logger.verbose('getMonitorInfo request sent.');
			}
		}, cb);
	}

	/**
	 *
	 * @param {Function} cb1
	 * @param {Function} cb2
	 */
	getMousePosition(cb1, cb2) {
		return RequestHelper.sendRequest({ topic: 'getMousePosition' }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb1);
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
	getRuntimeInfo(cb) {
		return RequestHelper.sendRequest({ topic: 'getRuntimeInfo' }, (eventObject, data) => {
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
			eventObject.cb(data);
		}, cb);
	}

	/**
	 *
	 * @param {@object} params object
	 * @param {string} params.arguments additional arguments to be passed to the asset.
	 * @param {string} params.alias "Alias" of the asset. Refers to an alias inside of the "appAssets" part of the application's manifest
	 * @param {*} cb1 Callback to be invoked upon method success
	 * @param {*} cb2 Callback to be invoked upon method failure
 	 */
	launchExternalProcess(params, cb1, cb2) {
		return RequestHelper.sendRequest({ topic: 'launchExternalProcess', data: { id: currentWindow.id, data: params } }, (eventObject, data) => {
			// If an error was returned by the main process, invoke the error callback.
			if (data.status === 'error') {
				logger.error(`launchExternalProcess: ${data.message}`);
				if (cb2) {
					return cb2({
						status: 'error',
						message: data.message,
						code: 'launch_fail',
					});
				}
			} else {
				logger.debug('launchExternalProcess request sent.');
				eventObject.cb(data);
			}
		}, cb1);
	}

	/**
	 *
	 * @param {String} url
	 * @param {Function} cb
	 */
	openUrlWithBrowser(url, cb) {
		return RequestHelper.sendRequest({ topic: 'openUrlWithBrowser', data: url }, (eventObject, data) => {
			checkAndLogAccessDenied(data);
			eventObject.cb(data);
		}, cb);
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

	setMinLogLevel() {
		logger.error('Unimplemented method: System.setMinLogLevel');
	}

	// unimplemented
	startCrashReporter() {
		logger.error('Unimplemented method: System.startCrashReporter');
	}

	// unimplemented
	getAppAssetInfo() {
		logger.error('Unimplemented method: System.getAppAssetInfo');
	}

	// unimplemented
	deleteCache() {
		logger.error('Unimplemented method: System.deleteCache');
	}

	// unimplemented
	downloadAsset() {
		logger.error('Unimplemented method: System.downloadAsset');
	}

	// unimplemented
	downloadPreloadScripts() {
		logger.error('Unimplemented method: System.downloadPreloadScripts');
	}

	// Not implemented purposefully
	downloadRuntime() {
		logger.error('Unimplemented method: System.downloadRuntime');
	}

	// Not implemented purposefully
	flushCookie() {
		logger.error('Unimplemented method: System.flushCookie');
	}

	// unimplemented
	getAllExternalApplication() {
		logger.error('Unimplemented method: System.getAllExternalApplication');
	}

	// unimplemented
	getCommandLineArguments() {
		logger.error('Unimplemented method: System.getCommandLineArguments');
	}

	// unimplemented
	getCookies() {
		logger.error('Unimplemented method: System.getCookies');
	}

	// unimplemented
	getCrashReporterState() {
		logger.error('Unimplemented method: System.getCrashReporterState');
	}

	// unimplemented
	getDeviceUserId() {
		logger.error('Unimplemented method: System.getDeviceUserId');
	}

	// unimplemented
	getEntityInfo() {
		logger.error('Unimplemented method: System.getEntityInfo');
	}

	// unimplemented
	getEnvironmentVariable() {
		logger.error('Unimplemented method: System.getEnvironmentVariable');
	}

	// unimplemented
	getFocusedWindow() {
		logger.error('Unimplemented method: System.getFocusedWindow');
	}

	// unimplemented
	getLogList() {
		logger.error('Unimplemented method: System.getLogList');
	}

	// unimplemented
	getMachineId() {
		logger.error('Unimplemented method: System.getMachineId');
	}

	// unimplemented
	getMinLogLevel() {
		logger.error('Unimplemented method: System.getMinLogLevel');
	}

	// unimplemented
	getProxySettings() {
		logger.error('Unimplemented method: System.getProxySettings');
	}

	// unimplemented
	log() {
		logger.error('Unimplemented method: System.log');
	}

	// unimplemented
	monitorExternalProcess() {
		logger.error('Unimplemented method: System.monitorExternalProcess');
	}

	// unimplemented
	readRegistryValue() {
		logger.error('Unimplemented method: System.readRegistryValue');
	}

	// unimplemented
	registerExternalConnection() {
		logger.error('Unimplemented method: System.registerExternalConnection');
	}

	// unimplemented
	releaseExternalProcess() {
		logger.error('Unimplemented method: System.releaseExternalProcess');
	}

	// unimplemented
	terminateExternalProcess() {
		logger.error('Unimplemented method: System.terminateExternalProcess');
	}

	// unimplemented
	updateProxySettings() {
		logger.error('Unimplemented method: System.updateProxySettings');
	}
}

module.exports = System;
