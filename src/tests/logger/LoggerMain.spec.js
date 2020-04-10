const { assert } = require('chai');
const sinon = require('sinon');
const winston = require('winston');
const { ipcMain } = require('electron-ipc-mock')();
const LoggerMain = require('../../logger/classes/LoggerMain');
const config = require('../../logger/config');
const consoleTransport = require('../../logger/transports/winston-terminal-transport');

describe('src/logger/classes/LoggerMain', () => {
	let loggerMain;
	let winstonLogger;
	beforeEach(() => {
		// Reset transports levels
		consoleTransport.level = 'debug';
		winstonLogger = winston.createLogger(config);
		loggerMain = new LoggerMain(ipcMain, winstonLogger);
	});

	it('Implements setLevel()', () => {
		assert.isFunction(loggerMain.setLevel);
	});
	it('Implements enableConsole()', () => {
		assert.isFunction(loggerMain.enableConsole);
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
	describe('LoggerMain#enableConsole', () => {
		it('Invokes winston#add', () => {
			const addSpy = sinon.spy(winstonLogger, 'add');
			loggerMain.enableConsole();
			assert.isTrue(addSpy.calledWith(consoleTransport));
			addSpy.restore(addSpy);
		})
	})
	describe('LoggerMain#setLevel', () => {
		it('Sets logging level on all transports', () => {
			const errorMessage = 'Failed to set logging level';
			loggerMain.setLevel('error');
			assert.equal(consoleTransport.level, 'error', errorMessage);
		});
		it('Does not set unsupported logging level', () => {
			const errorMessage = 'A wong logging level was set';
			loggerMain.setLevel('critical');
			assert.notEqual(consoleTransport.level, 'critical', errorMessage);
		});
		it('Converts level "log" to "log-" ', () => {
			const errorMessage = 'Failed to convert level "log" to "log-"';
			loggerMain.setLevel('log');
			assert.equal(consoleTransport.level, 'log-', errorMessage);
		});
	})
});
