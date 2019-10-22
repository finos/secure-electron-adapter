const { ipcRenderer } = require('electron');
const LoggerRenderer = require('./classes/LoggerRenderer');

let logger;

try {
	logger = new LoggerRenderer(ipcRenderer);
} catch (error) {
	logger = console;
	// Native console does not support verbose
	logger.verbose = logger.debug;
	logger.error(`Failed to instantiate LoggerRenderer ${error.message}`);
	logger.info('Falling back to native console');
}

module.exports = logger;
