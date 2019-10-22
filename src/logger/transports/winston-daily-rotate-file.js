const path = require('path');
const winston = require('winston');
const formatter = require('../formatters/basic');
const appData = require('../../main/helpers/getAppDataFolderSync')();
require('winston-daily-rotate-file');

module.exports = new (winston.transports.DailyRotateFile)({
	format: formatter,
	datePattern: 'YYYY-MM-DD',
	maxSize: '5m',
	maxFiles: '3',
	filename: path.join(
		appData,
		'Electron',
		'logs',
		'FEA-%DATE%.log'
	),
});
