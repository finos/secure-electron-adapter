const { assert } = require('chai');
const winston = require('winston');
const { ipcRenderer, ipcMain } = require('electron-ipc-mock')();
const LoggerMain = require('../../logger/classes/LoggerMain');
const LoggerRenderer = require('../../logger/classes/LoggerRenderer');

describe('src/logger/classes/LoggerRenderer', () => {
	let loggerRenderer;
	before(() => {
		loggerMain = new LoggerMain(ipcMain, winston);
		loggerRenderer = new LoggerRenderer(ipcRenderer);
	});
	it('loggerRenderer is an instance of LoggerRenderer', () => {
		assert.instanceOf(loggerRenderer, LoggerRenderer);
	});
	it('Implements error()', () => {
		assert.isFunction(loggerRenderer.error);
	});
	it('Implements warn()', () => {
		assert.isFunction(loggerRenderer.warn);
	});
	it('Implements info()', () => {
		assert.isFunction(loggerRenderer.info);
	});
	it('Implements log()', () => {
		assert.isFunction(loggerRenderer.log);
	});
	it('Implements debug()', () => {
		assert.isFunction(loggerRenderer.debug);
	});
	it('Implements verbose()', () => {
		assert.isFunction(loggerRenderer.verbose);
	});
});
