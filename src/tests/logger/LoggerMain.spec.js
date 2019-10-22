const { assert } = require('chai');
const winston = require('winston');
const { ipcMain } = require('electron-ipc-mock')();
const LoggerMain = require('../../logger/classes/LoggerMain');
const config = require('../../logger/config');

describe('src/logger/classes/LoggerMain', () => {
	let loggerMain;
	let winstonLogger;
	beforeEach(() => {
		winstonLogger = winston.createLogger(config);
		loggerMain = new LoggerMain(ipcMain, winstonLogger);
	});

	it('loggerMain is an instance of LoggerMain', () => {
		assert.instanceOf(loggerMain, LoggerMain);
	});
	it('Implements error()', () => {
		assert.isFunction(loggerMain.error);
	});
	it('Implements warn()', () => {
		assert.isFunction(loggerMain.warn);
	});
	it('Implements info()', () => {
		assert.isFunction(loggerMain.info);
	});
	it('Implements log()', () => {
		assert.isFunction(loggerMain.log);
	});
	it('Implements debug()', () => {
		assert.isFunction(loggerMain.debug);
	});
	it('Implements verbose()', () => {
		assert.isFunction(loggerMain.verbose);
	});
});
