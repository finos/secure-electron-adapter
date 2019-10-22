require('events').EventEmitter.defaultMaxListeners = 0;
const { assert } = require('chai');
const sinon = require('sinon');
const winston = require('winston');
const { ipcRenderer, ipcMain } = require('electron-ipc-mock')();
const LoggerMain = require('../../logger/classes/LoggerMain');
const LoggerRenderer = require('../../logger/classes/LoggerRenderer');
const config = require('../../logger/config');

describe('src/logger', () => {
	const sandbox = sinon.createSandbox();
	let loggerMain;
	let loggerRenderer;
	let winstonLogger;
	beforeEach(() => {
		winstonLogger = winston.createLogger(config);
		loggerMain = new LoggerMain(ipcMain, winstonLogger);
		loggerRenderer = new LoggerRenderer(ipcRenderer);
	});
	it('LoggerRenderer.info passes logs to LoggerMain.info', (done) => {
		const info = sandbox.spy(loggerMain, 'info');
		loggerRenderer.info('Test log message', 'another message');
		setTimeout(() => {
			assert.isTrue(info.calledOnce);
			done();
		}, 50);
	});
	it('LoggerRenderer.error passes logs to LoggerMain.error', (done) => {
		const error = sandbox.spy(loggerMain, 'error');
		loggerRenderer.error('Test log message');
		setTimeout(() => {
			assert.isTrue(error.calledOnce);
			done();
		}, 50);
	});
	it('LoggerRenderer.warn passes logs to LoggerMain.warn', (done) => {
		const warn = sandbox.spy(loggerMain, 'warn');
		loggerRenderer.warn('Test log message');
		setTimeout(() => {
			assert.isTrue(warn.calledOnce);
			done();
		}, 50);
	});
	it('LoggerRenderer.debug passes logs to LoggerMain.debug', (done) => {
		const debug = sandbox.spy(loggerMain, 'debug');
		loggerRenderer.debug('Test log message');
		setTimeout(() => {
			assert.isTrue(debug.calledOnce);
			done();
		}, 50);
	});
	it('LoggerRenderer.log passes logs to LoggerMain.log', (done) => {
		const log = sandbox.spy(loggerMain, 'log');
		loggerRenderer.log('Test log message');
		setTimeout(() => {
			assert.isTrue(log.calledOnce);
			done();
		}, 50);
	});
});
