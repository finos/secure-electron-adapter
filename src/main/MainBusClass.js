const { ipcMain, WebContents, BrowserWindow } = require('electron');
const EventEmitter = require('events').EventEmitter;
const { accessDenied } = require('../common/helpers');
const PermissionsManager = require('../permissions/PermissionsManager');
const logger = require('../logger/')();

/**
 * This is where all communication happens.In/Out
 */
class MainBus extends EventEmitter {
	constructor() {
		super();
		this.request = {};
		this.setupMainListener = this.setupMainListener.bind(this);
		this.subscribers = {};
		this.listeners = {};
		this.setupMainListener();
		this.setupIPC();
	}

	/**
	 * Removes all subscriptions for a window, given its name. This happens on window close.
	 *
	 * @param {*} name
	 * @memberof MainBus
	 */
	unsubscribeWindow(name) {
		Object.keys(this.subscribers).forEach((key) => {
			if (key.includes(name)) {
				delete this.subscribers[key];
			}
		});
	}

	/**
	 * @param {ElectronEvent} event event from the renderer process
	 * @param {windowProcessEvent} windowProcessEvent used to create a BusEvent
	 * @param {UUID} responseUUID channel to send response
	 *
	 * @return undefined
	 */
	handleMainRequest(event, windowProcessEvent, responseUUID) {
		try {
			if (!windowProcessEvent.topic) {
				this.sendMessage(event.sender, { error: 'No topic provided' }, responseUUID);
			}
	
			const busEvent = this.buildRequestObject(event, windowProcessEvent, responseUUID);
	
			this.emit(windowProcessEvent.topic, busEvent);
		} catch(ex) {
			logger.error(ex)
			event.returnValue = { error: ex.message }
			this.sendMessage(event.sender, { error: ex.message }, responseUUID);
		}
	}

	/**
	 * add a system listener
	 *
	 * @param {ElectronEvent} event event from the renderer process
	 * @param {String} eventTopic
	 *
	 * @return undefined
	 */
	addSystemListener(event, eventTopic) {
		if (!this.listeners[eventTopic]) {
			this.listeners[eventTopic] = {};
		}
		// to send an asynchronous message back to the sender, you can use event.sender.send(...).
		// https://electronjs.org/docs/api/ipc-main
		this.listeners[eventTopic][event.sender.id] = { sender: event.sender };
		logger.verbose(`Added system listener ${event.sender.id} to ${eventTopic}`);
	}

	/**
	 * remove a system listener
	 *
	 * @param {ElectronEvent} event event from the renderer process
	 * @param {String} eventTopic
	 *
	 * @return undefined
	 */
	removeSystemListener(event, eventTopic) {
		if (!this.listeners[eventTopic]) {
			return;
		}

		if (!this.listeners[eventTopic][event.sender.id]) {
			return;
		}

		// This can log for every window depending on the timing for shutdown. Making verbose because it's usually irrelevant
		logger.verbose(`Removing system listener listening to ${eventTopic} from ${event.sender.id}`);
		delete this.listeners[eventTopic][event.sender.id];
	}

	/**
	 * sets up three channels 'sea.mainRequest', 'system.addlistener', and 'system.removelistener'
	 * all api communications occur on 'sea.mainRequest' from the renderer processes.
	 * MainBus emits the sub topic System, WindowProcess, window, etc.
	 */
	setupMainListener() {
		ipcMain.on('sea.mainRequest', this.handleMainRequest.bind(this));
		ipcMain.on('system.addlistener', this.addSystemListener.bind(this));
		ipcMain.on('system.removelistener', this.removeSystemListener.bind(this));
	}

	/**
	 * sends an event to all system listeners
	 *
	 * @param {String} eventTopic
	 * @param {Object} data
	 */
	sendEvent(eventTopic, data) {
		if (!this.listeners[eventTopic]) return;
		const listenerList = this.listeners[eventTopic];
		for (const senderKey in listenerList) {
			try { // we need to remove listeners when a window closes
				listenerList[senderKey].sender.send('systemResponse', { topic: eventTopic, data });
			} catch (err) {
				logger.error(`Unable to send event to ${listenerList[senderKey]} ${err.message}`);
			}
		}
	}

	/**
	 * build a BusEvent to be emitted by MainBus
	 *
	 * @param {Electron Event} event - The electron event
	 * @param {windowProcessEvent} args - Information we need to handle the request
	 * @param {UUID} responseUUID - This tells us what channel to respond on
	 *
	 * @return {BusEvent}
	 */
	buildRequestObject(event, args, responseUUID) {
		return {
			sender: event.sender,
			rawEvent: event,
			rawArgs: args,
			topic: args.topic,
			data: args.data,
			getBrowserWindow: () => BrowserWindow.fromWebContents(event.sender),
			respondSync: (response) => {
				event.returnValue = response;
			},
			respond: (response) => {
				if (!event.sender) return;
				try {
					event.sender.send(responseUUID, response);
				} catch (err) {
					logger.error(`Window is gone, unable to send ${args.topic}`);
				}
			},
		};
	}

	/**
	 *
	 * @param {ElectronEvent} event
	 * @param {Object} arg
	 */
	async onIPCSubscribe(event, arg) {
		// Only allow subscribing if permitted
		const mainWin = await process.mainWindowProcessManager.findWindowByName(event.sender.browserWindowOptions.name);
		const permission = 'MessageBus.subscribe';
		if (!PermissionsManager.checkPermission(mainWin, permission)) {
			try {
				event.sender.send('subscribeResponseError', accessDenied(permission));
			} catch (error) {
				logger.error('Error sending subscribeResponseError', error);
			}
			logger.info(`Subscription to electron event id ${event.sender.id} denied. Does not have the permission.`);
		}
		if (!this.subscribers[arg.topic]) {
			this.subscribers[arg.topic] = [];
		}
		arg.sender = event.sender;
		this.subscribers[arg.topic][arg.subscribeUUID] = arg;
		logger.debug(`Subscribing to topic ${arg.topic} from electron event id ${event.sender.id}`);
	}

	/**
	 *
	 * @param {ElectronEvent} event
	 * @param {Object} arg
	 */
	async onIPCUnsubscribe(event, arg) {
		// Only allow unsubscribing if permitted
		const mainWin = await process.mainWindowProcessManager.findWindowByName(event.sender.browserWindowOptions.name);
		const permission = 'MessageBus.unsubscribe';
		if (!PermissionsManager.checkPermission(mainWin, permission)) {
			try {
				event.sender.send('unSubscribeResponseError', accessDenied(permission));
			} catch (err) {
				logger.error('Error sending unSubscribeResponseError', err);
			}
			logger.debug(`Unsubscribe to electron event id ${event.sender.id} denied. Does not have the permission.`);
			return;
		}
		if (!this.subscribers[arg.topic]) return;
		logger.debug(`Unsubscribing to topic ${arg.topic} from electron event id ${event.sender.id}`);
		delete this.subscribers[arg.topic][arg.subscribeUUID];
	}

	/**
	 * Recieves a publish to a specific topic from on of the render processes and sends subscribeResponse to each of the topic subscribers (in their own window/redender process)
	 *
	 * @param {ElectronEvent} event
	 * @param {Object} arg
	 */
	async onIPCPublish(event, arg) {
		const mainWin = await process.mainWindowProcessManager.findWindowByName(event.sender.browserWindowOptions.name);
		const permission = 'MessageBus.publish';

		// return error if publishing not permitted within permissions
		if (!PermissionsManager.checkPermission(mainWin, permission)) {
			try {
				event.sender.send('publishResponseError', accessDenied(permission));
			} catch (error) {
				logger.error('Error sending permission-failure publishResponseError', error);
			}
		} else {
			const subscribers = this.subscribers[arg.topic] || {};

			// MM Note: I was concerned there might be a race condition where getOwnerBrowserWindow could fail because sender immediately closed after publish (it depends in part on Electron implementation).
			// However testing I didn't see this so appears to be fine. If this ever happened though could put the sender's appUUID in the publish so getOwnerBrowserWindow wouldn't need to be called here.
			const senderBrowserWindow = event.sender.getOwnerBrowserWindow();

			for (const subscriberKey in subscribers) {
				const subscriber = subscribers[subscriberKey];
				if (subscriber.senderUUID === '*' || subscriber.senderUUID == senderBrowserWindow.appUUID) {
					try {
						subscriber.sender.send('subscribeResponse', {
							senderId: event.sender.id,
							data: arg.data,
							subscribeUUID: subscriber.subscribeUUID,
							uuid: senderBrowserWindow.appUUID,
						});
					} catch (error) {
						logger.error('Error sending subscribeResponse', error);
					}
				}
			}
		}
	}

	/**
	 * Pub/Sub for window communication. This can be used with/instead of the shared worker. This is MUCH slower. Basically, polyfill of the IAM
	 * @return undefined
	 */
	setupIPC() {
		ipcMain.on('sea.subscribe', this.onIPCSubscribe.bind(this));
		ipcMain.on('sea.unSubscribe', this.onIPCUnsubscribe.bind(this));
		ipcMain.on('sea.publish', this.onIPCPublish.bind(this));
	}
}

// For some reason MainBus can't be used inside some files
// Adding it to process allows it to be accessible in all places.
module.exports = MainBus;
