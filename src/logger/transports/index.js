const dailyRotateFile = require('./winston-daily-rotate-file');
const terminal = require('./winston-terminal-transport');

module.exports = [
	dailyRotateFile,
	terminal
];
