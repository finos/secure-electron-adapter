class LoggerRenderer {
	/**
	 * Create LoggerRenderer instance
	 * @param {EventEmitter} ipcRenderer Electron's ipcRenderer
	 */
	constructor(ipcRenderer) {
		// Make sure a valid ipc passed
		if (!ipcRenderer || !ipcRenderer.send) {
			throw new TypeError('Invalid ipcRenderer');
		}
		this.ipc = ipcRenderer;
	}

	/**
	 * Sends `logger:message` message to main logger
	 * @param {string} level The log level
	 * @param {...*} args The log message(s)
	 * @return {void}
	 * @private
	 */
	send(level, args) {
		this.ipc.send('logger:message', {
			level,
			args
		});
	}

	/**
	 * Logs a message of type error
	 * @param {...*} messages The log message(s)
	 */
	error(...messages) {
		this.send('error', messages);
	}

	/**
	 * Logs a message of type warn
	 * @param {...*} messages The log message(s)
	 */
	warn(...messages) {
		this.send('warn', messages);
	}

	/**
	 * Logs a message of type info
	 * @param {...*} messages The log message(s)
	 */
	info(...messages) {
		this.send('info', messages);
	}

	/**
	 * Logs a message of type log
	 * @param {...*} messages The log message(s)
	 */
	log(...messages) {
		this.send('log', messages);
	}

	/**
	 * Logs a message of type debug
	 * @param {...*} messages The log message(s)
	 */
	debug(...messages) {
		this.send('debug', messages);
	}

	/**
	 * Logs a message of type verbose
	 * @param {...*} messages The log message(s)
	 */
	verbose(...messages) {
		this.send('verbose', messages);
	}
}

module.exports = LoggerRenderer;
