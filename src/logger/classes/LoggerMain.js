const transports = require('../transports');

const LOGGER_ON_MESSAGE = 'logger:message';

class LoggerMain {
	/**
	 * Create LoggerMain instance
	 * @param {EventEmitter} ipcMain Electron's ipcMain
	 */
	constructor(ipcMain, winstonLogger) {
		// Make sure a valid ipc passed
		if (!ipcMain || !ipcMain.on) {
			throw new TypeError('Invalid ipcMain');
		}
		if (!winstonLogger) {
			throw new TypeError('Invalid winston instance');
		}
		this.ipc = ipcMain;
		this.winston = winstonLogger;
		// Bind correct context
		this.onLog = this.onLog.bind(this);
		// Register event listeners
		this.setUpListeners();
	}

	/**
	 * Sets the minimum log level on all transports
	 * @param {string} level The minimum logging level
	 */
	setLevel(level = 'debug') {
		if (!this[level]) {
			this.warn(`Bad logging level ${level} passed to setLevel`);
			return;
		}
		transports.forEach((transport) => {
			transport.level = level;
		});
		this.debug(`Changed logging level to ${level}`);
	}

	/**
	 * Register event listeners on electron's ipc
	 * @return {void}
	 * @private
	 */
	setUpListeners() {
		this.ipc.on(LOGGER_ON_MESSAGE, this.onLog);
	}

	/**
	 * Deals with log messages that are emitted from
	 * renderer process's logger through electron's ipc
	 * @param {event} event
	 * @param {object} message
	 * @return {void}
	 * @private
	 */
	onLog(event, message) {
		// Make sure that we have a valid message
		// if so, forward it to local logging methods
		if (message && message.level && message.args) {
			this[message.level](message.args);
		}
	}

	/**
	 * Logs a message of type error
	 * @param {...*} messages The log message(s)
	 */
	error(...messages) {
		this.winston.error(messages);
	}

	/**
	 * Logs a message of type warn
	 * @param {...*} messages The log message(s)
	 */
	warn(...messages) {
		this.winston.warn(messages);
	}

	/**
	 * Logs a message of type info
	 * @param {...*} messages The log message(s)
	 */
	info(...messages) {
		this.winston.info(messages);
	}

	/**
	 * Logs a message of type log
	 * @param {...*} messages The log message(s)
	 */
	log(...messages) {
		this.winston['log-'](messages);
	}

	/**
	 * Logs a message of type debug
	 * @param {...*} messages The log message(s)
	 */
	debug(...messages) {
		this.winston.debug(messages);
	}

	/**
	 * Logs a message of type verbose
	 * @param {...*} messages The log message(s)
	 */
	verbose(...messages) {
		this.winston.verbose(messages);
	}
}

module.exports = LoggerMain;
