
const WebSocket = require('websocket').client;
const EventEmitter = require('events').EventEmitter;

/**
 *SocketConnection is a wrapper around websocket the allows us to emit events and handles the basic connection functions
 *
 * @export
 * @class SocketConnection
 * @extends {EventEmitter}
 */
module.exports = class SocketConnection extends EventEmitter {
	constructor(port) {
		super();
		this.ws = null;
		this.port = port || 8392;
		this.wsConnectionFailureTimeout = null;
		this.onMessage = this.onMessage.bind(this);
	}

	/**
	 *Connect to a websocket
	 *
	 * @returns
	 * @memberof SocketConnection
	 */
	connect() {
		this.baseWebsocketConnect();
	}

	baseWebsocketConnect() {
		if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;// If we're connected don't try to connect again

		if (this.ws && this.ws.readyState === 2) {
			const timeout = setTimeout(() => { // wait for the ws to be closed before trying to reconnect
				clearTimeout(timeout);
				this.connect();
			}, 1000);
			return;
		}
		const ws = this.ws = new WebSocket();
		// Called when the socket connection is open
		ws.on('connect', (connection) => {
			connection.on('message', (msg) => {
				let parsedMessage;
				try {
					parsedMessage = JSON.parse(msg.utf8Data);
					this.onMessage(parsedMessage);
				} catch (err) {

				}
			});
			connection.on('close', () => {
				console.log('onclose');
				this.emit('socketClosed');
				if (this.error) {
					console.log('reconnecting');
					this.error = null;
					this.connect(); // if we died because of an error;
				}
			});
			connection.on('error', (err) => {
				console.log('onerror', err);
				this.emit('socketError', err);
				this.error = err;
			});
		});
		ws.connect(`http://127.0.0.1:${this.port}`);
	}

	/**
	 * Overwrite this to handle the message a different way
	 * @param {Object} parsedMessage
	 */
	onMessage(parsedMessage) {
		return this.emit(parsedMessage.topic, parsedMessage);
	}

	/**
	 *send data thorugh the websocket
	 *
	 * @param {Object} data
	 * @memberof SocketConnection
	 */
	send(data) {
		if (!this.ws || this.ws.readyState !== 1) return;
		this.ws.send(data);
	}
};
