const ipcRenderer = require('electron').ipcRenderer;
const EventEmitter = require('events').EventEmitter;

const uuidV4 = require('uuid/v4');

/**
* This is a central location for all of our communication in the render process
*
* @class RequestHelper
* @extends {EventEmitter}
*/
class RequestHelper extends EventEmitter {
	constructor() {
		super();
		this.request = {};

		ipcRenderer.on('systemResponse', this.systemResponse.bind(this));
	}

	asyncSendRequest(seaRequest) {
		return new Promise((resolve, reject) => {
			const responseUUID = uuidV4();
			ipcRenderer.on(responseUUID, (event, data) => resolve(data));
			ipcRenderer.send('sea.mainRequest', seaRequest, responseUUID);
		});
	}

	/**
	 *  Here's how this works:
	 * 1. We listen on a channel (responseUUID).
	 * 2. We send a message to the main process with a topic, data,
	 * and where to return the response (responseUUID).
	 * 3. When we receive a response, we invoke the functionCB.
	 *
	 * @param {RequestHelperRequest} params
	 * @param {Function} [functionCB] Method to be invoked after the main
	 * process responds to the message.
	 * @param {Funtion} [cb] Method to be invoked to return result back to sea user
	 * @return undefined
	 */
	sendRequest(params, functionCB = Function.prototype, cb = Function.prototype) {
		const { topic, data, persistChannel } = params;
		const responseUUID = uuidV4();

		/**
		 * @todo refactor into a proper class.
		 * @type {RequestHelperEventObject}
		 */
		const eventObject = {
			topic,
			data,
			responseUUID,
			functionCB,
			cb
		};

		// @todo it doesn't appear self.request is being used anywhere. Candidate for deletion.
		const self = this;

		/**
		 * Actually does the dirty work of sending a message, listening for a response, and cleaning up listeners.
		 * @param {RequestHelperEventObject} eObject
		 */
		function sendRequestOut(eObject) {
			const reUUID = eObject.responseUUID;
			/**
			 * @param {object} event ignored parameter
			 * @param {any} data whatever the main process sent back.
			 */
			function handleResponse(event, data) {
				// If we don't want to persist this listener, clean up as soon as we've received the response.
				if (!persistChannel) {
					delete self.request[reUUID];
					ipcRenderer.removeListener(reUUID, handleResponse);
				}
				eObject.functionCB(eventObject, data);
			}
			self.request[reUUID] = eObject;

			// Listen on the UUID for a response to this particular query.
			ipcRenderer.on(reUUID, handleResponse);

			const SendObect = {
				topic,
				data
			};

			ipcRenderer.send('sea.mainRequest', SendObect, reUUID);
		}

		sendRequestOut(eventObject);
	}

	/**
	 *This is where we catch all events from the main process
	 *
	 * @param {ElectronEvent} event
	 * @param {Object} response
	 * @memberof RequestHelper
	 */
	systemResponse(event, response) {
		this.emit(response.topic, response.data);
	}

	/**
	 *We can keep track of all listener in a central location. This allows us to cut down on the communication to the main process
	 *
	 * @param {String} eventName
	 * @param {Function} listener
	 * @memberof RequestHelper
	 */
	addListener(eventName, listener) {
		const count = this.listenerCount(eventName);
		super.addListener(eventName, listener);
		if (count === 0) { // If we don't have any listeners on this topic, add one
			ipcRenderer.send('system.addlistener', eventName);
		}
	}

	removeListener(eventName, listener) {
		super.removeListener(eventName, listener);
		const count = this.listenerCount(eventName);
		if (count === 0) ipcRenderer.send('system.removeListener', eventName);// Only remove our listener if we have no more listeners
	}
}
module.exports = new RequestHelper();
