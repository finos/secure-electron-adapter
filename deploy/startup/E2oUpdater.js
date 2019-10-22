/**
 * This file handles the update for new electron packages.
 * https://electronjs.org/docs/api/auto-updater
 */
const { autoUpdater, dialog } = require('electron');
const logger = require('../../src/logger/')();

class Updater {
	/**
	 * @param {*} feedURL - The server url to look for updates
	 * @param {*} updateTimeout  - How often to look for updates
	 */
	constructor(feedURL, updateTimeout = 60000) {
		this.feedURL = feedURL;
		this.updateTimeout = updateTimeout;

		this._startUpdater = this._startUpdater.bind(this);
		this.setupUpdateListeners();
	}

	/**
	 * Sets up all of the update listeners
	 */
	setupUpdateListeners() {
		autoUpdater.setFeedURL(this.feedURL);
		autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
			logger.info('update-downloaded');
			// A dialog to ask the user if they would like to update now. If yes, the application shuts down and starts the update process.
			const dialogOpts = {
				type: 'info',
				buttons: ['Restart', 'Later'],
				title: 'Application Update',
				message: process.platform === 'win32' ? releaseNotes : releaseName,
				detail: 'A new version has been downloaded. Restart the application to apply the updates.'
			};

			dialog.showMessageBox(dialogOpts, (response) => {
				if (response === 0) autoUpdater.quitAndInstall();
			});
		});
		autoUpdater.on('update-available', (event) => {
			logger.info('Update available');
		});
		autoUpdater.on('before-quit-for-update', (event) => {
			logger.debug('before-quit-for-update');
		});
		autoUpdater.on('checking-for-update', (event) => {
			logger.info('Checking for update');
			clearTimeout(this.updateChecker);
		});
		autoUpdater.on('update-not-available', (event) => {
			logger.info('Update not available');
			this._startUpdater();
		});
		autoUpdater.on('error', (message) => {
			logger.error(`There was a problem updating the application ${message}`);
		});
		autoUpdater.checkForUpdates();
	}

	_startUpdater() {
		this.updateChecker = setTimeout(() => {
			logger.info('Checking for updates');
			autoUpdater.checkForUpdates();
		}, this.updateTimeout);
	}
}
module.exports = Updater;
