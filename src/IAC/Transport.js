

const ws = require('ws');
const path = require('path');
const https = require('https');
const fs = require('fs');
const http = require('http');
const url = require('url');
const logger = require('../logger/')();

/**
 * Inter-Application Communication (IAC) is a transport that allows communication between discrete Electron applications
 * and between non-Electron applications. It works by opening a websocket on the address provided by IAC.serverAddress
 * in the manifest. It is impossible to access IAC from another machine, since 127.0.0.1 is the machine's loopback
 * device. The websocket supports https by including a certificate for wss://localhost.chartiq.com, but please note that
 * this is only a workaround for mixed-content browser rules. The IAC should not be considered immune from desktop based
 * wiresniffers.
 *
 * IAC uses socket.io. This allows non-javascript applications to very easily connect.
 *
 * The IAC is meant to be used with the Finsemble router.
 *
 * Configuration for the IAC typically comes from the e2o manifest entry:
 * {
 *    IAC : {
 *       serverAddress: "ws://127.0.0.1:3376"
 *    }
 * }
 */
module.exports = class Transport {
	/**
	 * Initializes a new instance of the Transport class.
	 *
	 * @param {number} port=3376 The port to run
	 * @param {string} host="127.0.0.1"
	 * @param {object} options
	 * @param {string} options.key="./localhost.chartiq.com.key"
	 * @param {string} options.cert="./localhost.chartiq.com.crt"
	 * @param {string} options.ca="./IntermediateCA.crt"
	 * @param {boolean} secure Set explicitly to false to turn off https
	 */
	constructor(port, host, options) {
		this.wssMain = null;
		this.wssRouter = null;
		this.port = port || 3376;
		this.host = host || '127.0.0.1';
		this.options = options || {};
		this.wsConnectionFailureTimeout = null;
	}

	/**
	 * Connect the transport to the the web socket and to the router.
	 */
	connect() {
		if (this.wssMain) {
			return logger.warn('IAC: Transport.connect called multiple times');
		}

		// Check for secure connection
		if (!this.options.key) {
			try {
				this.options.key = fs.readFileSync(path.join(__dirname, './localhost.chartiq.com.key'), 'utf8');
				this.options.cert = fs.readFileSync(path.join(__dirname, './localhost.chartiq.com.crt'), 'utf8');
				this.options.ca = fs.readFileSync(path.join(__dirname, './IntermediateCA.crt'), 'utf8');
			} catch (e) {
				// TODO: If this happens, should we stop, or set the connection to unsecured?
				logger.error(`IAC certificates error ${e.message}`);
			}
		}
		if (this.options.key && this.options.secure !== false) this.options.secure = true;
		const { port, host, options } = this;
		logger.info(`Starting IAC on ${host}:${port} secure:${options.secure}`);

		// We must have an https server to get the certs attached
		const protocol = this.options.secure ? https : http;
		const server = protocol.createServer(this.options).listen(this.port, this.host);

		// create two socket servers with different paths,
		// to be routed messages by the server's on('upgrade') event
		this.wssMain = new ws.Server({ noServer: true });
		this.wssRouter = new ws.Server({ noServer: true });

		// Main ws events handlers
		this.wssMain.on('connection', (client) => {
			logger.log('IAC: ws.on.connection');
			client.on('close', () => {
				logger.log('IAC: client.on.disconnect');
				client.emit('socketClosed');
				if (client.error) {
					logger.warn('IAC: ws reconnecting because close on error.');
					client.error = null;
				}
			});
			client.on('error', (err) => {
				logger.error(`IAC: client.on.error ${err}`);
				client.emit('socketError', err);
				client.error = err;
			});
		});

		// Router ws events handlers
		logger.log('IAC: Creating router listeners');
		this.wssRouter.on('connection', (socket) => {
			logger.log('IAC: router.on.connection');
			// TODO: Currently all messages are broadcast to everyone here. Need to optimize this in the future
			socket.on('message', (dataString) => {
				this.wssRouter.clients.forEach((client) => {
					if (client.readyState === ws.OPEN) {
						client.send(dataString);
					}
				});
			});

			socket.on('close', () => {
				logger.log('IAC: router.on.disconnect');
				socket.emit('socketClosed');
				if (socket.error) {
					logger.error('IAC: router error', socket.error);
					socket.error = null;
				}
			});
			socket.on('error', (err) => {
				logger.error('IAC: router onerror', err);
				socket.emit('socketError', err);
				socket.error = err;
			});
		});

		// Recommended method for multiple servers,
		// see https://www.npmjs.com/package/ws#multiple-servers-sharing-a-single-https-server
		server.on('upgrade', (request, socket, head) => {
			const pathname = url.parse(request.url).pathname;
			logger.log(`IAC: server.onUpgrade pathname: ${pathname}`);

			if (pathname === '/router') {
				this.wssRouter.handleUpgrade(request, socket, head, (ws) => {
					this.wssRouter.emit('connection', ws, request);
				});
			} else {
				this.wssMain.handleUpgrade(request, socket, head, (ws) => {
					this.wssMain.emit('connection', ws, request);
				});
			}
		});
	}

	onMessage(msg) {
		logger.debug('IAC: transport message', msg);
	}

	setupListeners() {
		logger.debug('IAC: SETUP LISTENERS');
	}
};
