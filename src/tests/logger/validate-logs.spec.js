const fs = require('fs');
const path = require('path');
const { assert } = require('chai');
const winston = require('winston');
const { ipcMain } = require('electron-ipc-mock')();
const LoggerMain = require('../../logger/classes/LoggerMain');
const config = require('../../logger/config');
const appData = require('../../main/helpers/getAppDataFolderSync').folderPath;

describe('Validate logs', () => {
	const logsDirectory = path.join(
		appData,
		'logs'
	);
	const winstonLogger = winston.createLogger(config);
	const loggerMain = new LoggerMain(ipcMain, winstonLogger);
	const date = new Date();
	const month = `0${date.getMonth() + 1}`.slice(-2);
	const day = `0${date.getDate()}`.slice(-2);
	const expectedFileName = `SEA-${date.getFullYear()}-${month}-${day}.log`;
	// Generate few logs
	loggerMain.verbose('test verbose');
	loggerMain.debug('test debug');
	loggerMain.log('test log');
	loggerMain.info('test info');
	loggerMain.warn('test warn');
	loggerMain.error('test error');

	it('Creates a log file', () => {
		// Get a list of files from logs folder
		const fileList = fs.readdirSync(logsDirectory);
		// Check for the expected file
		assert.include(fileList, expectedFileName);
	});
	it('Writes properly formatted logs', () => {
		// Read log file contents
		const fileContents = fs.readFileSync(path.join(logsDirectory, expectedFileName));
		const logLines = fileContents.toString().split(/\n/).splice(0, -1);
		// Validate format
		for (const line in logLines) {
			assert.match(lines[line], /^\d{4}.*Z\s(debug|log-|info|warn|error|verbose)\s.*/);
		}
	});
});
