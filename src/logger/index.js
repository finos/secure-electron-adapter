/* eslint-disable arrow-body-style */
const { ipcMain } = require('electron');

/**
 * Returns the main logger if called in the main process
 * or renderer logger if called in a renderer process.
 */
module.exports = () => {
	return ipcMain
		? require('./main')
		: require('./renderer');
};
