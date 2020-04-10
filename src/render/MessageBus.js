const { ipcRenderer } = require('electron');
const EventEmitter = require('events').EventEmitter;
const uuidV4 = require('uuid/v4');
const { checkAndLogAccessDenied } = require('./common');
const logger = require('../logger')();

/**
 * An implementation of the MessageBus interface that utilizes Electron's IPC as an implementation.
 *
 * These requests are handled in the main process by MainBus.
 *
 */

class MessageBus extends EventEmitter {
	constructor(params) {
		super();
		this.subscribers = {};
		this.setUpListeners();
		this.bindAllFunctions();
	}

	bindAllFunctions() {
		const self = this;
		for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(self))) {
			const method = self[name];
			// skip constructor
			if (!(method instanceof Function) || method === MessageBus) continue;
			self[name] = self[name].bind(self);
		}
	}

	setUpListeners() {
		ipcRenderer.on('subscribeResponse', this.onSubscribeResponse.bind(this));
		ipcRenderer.on('subscribeResponseError', (event, response) => {
			checkAndLogAccessDenied(response);
		});
		ipcRenderer.on('unSubscribeResponseError', (event, response) => {
			checkAndLogAccessDenied(response);
		});
		ipcRenderer.on('publishResponseError', (event, response) => {
			checkAndLogAccessDenied(response);
		});
	}

	/**
	 *
	 * @param {any} event Ignored property
	 * @param {object} response Response from the main process. Someone has published information to us.
	 * @param {any} response.data information sent back to us
	 * @param {string} response.uuid unique ID for this response
	 */
	onSubscribeResponse(event, response) {
		const subscriberObject = this.subscribers[response.subscribeUUID];
		if (subscriberObject) {
			subscriberObject.listener(response.data, response.uuid);
		}
	}

	/**
	 * Take arguments to subscribe function and ensure each arg goes to the correct prop.
	 *
	 * @param  {...any} args
	 * @return {Object} parsedArgs
	 */
	parseSubscribeArgs(...args) {
		const argTypes = args.map(arg => typeof arg);
		const parsedArgs = {
			senderUUID: args[0],
		};
		// subscribe(senderUuid, nameopt, topic, listener, callbackopt, errorCallbackopt)
		// if argTypes[2] is a string and not a function, we know that args[1] is the name
		if (argTypes[2] === 'string') {
			parsedArgs.name = args[1];
			parsedArgs.topic = args[2];
			parsedArgs.listener = args[3] || Function.prototype;
			parsedArgs.callback = args[4] || Function.prototype;
			parsedArgs.errorCallback = args[5] || Function.prototype;
		} else {
			parsedArgs.name = null;
			parsedArgs.topic = args[1];
			parsedArgs.listener = args[2];
			parsedArgs.callback = args[3] || Function.prototype;
			parsedArgs.errorCallback = args[4] || Function.prototype;
		}
		return parsedArgs;
	}

	/**
	 * @param {string} topic topic for your message
	 * @param {any} message Data to send to other subscribers
	 * @param {Function} callback Function to be invoked when the publish has completed
	 * @param {Function} errorCallback Function to be invoked if the publish fails.
	 */
	publish(topic, message, callback = Function.prototype, errorCallback = Function.prototype) {
		try {
			ipcRenderer.send('sea.publish', { topic, data: message });
			if (callback) callback();
		} catch (err) {
			logger.warn(`Publish topic ${topic} failed. ${err.message}`);
			errorCallback(err);
		}
	}

	/**
	 *
	 * @param {string} senderUUIDArg UUID of the sender. We will return the response to this UUID.
	 * @param {string} topicArg Essentially a channel. We'll only react to messages on this topic from this specific
	 * sender.
	 * @param {Function} listenerArg Method to be invoked when the specified sender publishes a message on the specified
	 * topic.
	 * @param {Function} [callbackArg] Callback to be invoked upon successful subscribe
	 * @param {Function} [errorCallbackArg] Callback to be invoked upon unsuccessful subscribe.
	 */
	subscribe(senderUUIDArg, topicArg, listenerArg, callbackArg = Function.prototype, errorCallbackArg = Function.prototype) {
		try {
			// Normalizes input
			const {
				senderUUID, topic, listener, callback, errorCallback
			} = this.parseSubscribeArgs(senderUUIDArg, topicArg, listenerArg, callbackArg, errorCallbackArg);
			const subscribeUUID = uuidV4();
			const subscribeObject = {
				subscribeUUID,
				senderUUID,
				topic
			};

			ipcRenderer.send('sea.subscribe', subscribeObject);

			subscribeObject.listener = listener;

			// We cache the subscribe object. The listener will be invoked when the specified sender publishes a
			// message on the specified topic
			this.subscribers[subscribeUUID] = subscribeObject;

			// @todo probably don't need to check for callback since it has a default. Leaving for now. Brad - 2/13/19
			// Return a success callback "We subscribed successfully".
			if (callback) callback();
		} catch (err) {
			logger.warn(`Subscribing to ${topic} failed. ${err.message}`);
			errorCallback(err);
		}
	}
}

module.exports = new MessageBus();
