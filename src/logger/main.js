const { ipcMain } = require('electron');
const winston = require('winston');
const winstonLogger = winston.createLogger(require('./config'));
const LoggerMain = require('./classes/LoggerMain');

let logger;

try {
	logger = new LoggerMain(ipcMain, winstonLogger);
} catch (error) {
	logger = console;
	// Native console does not support verbose
	logger.verbose = logger.debug;
	logger.error(`Failed to instantiate LoggerMain ${error.message}`);
	logger.info('Falling back to native console');
}

module.exports = logger;
