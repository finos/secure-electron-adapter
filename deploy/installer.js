/**
 * This file is a wrapper around `electron-wininstaller. It creates an installer for an electron application.
 */

// https://github.com/electron/windows-installer
const windowsInstaller = require('electron-winstaller');
const Joi = require('joi');
const installerSchema = require('./schemas/installer');
// Our default for the installer
const defaults = {
	name: 'ElectronAdapter',
	title: 'ElectronAdapter',
	authors: 'ChartIQ',
	noMsi: true,
	outputDirectory: './',
	exe: 'ElectronAdapter',
	iconUrl: null,
	setupIcon: null,
	skipUpdateIcon: true,
	description: 'Your application'
};

/**
 * This fucntion creates an installer from the passed in config. It returns a promise
 * @param {*} configs
 */
async function createInstaller(configs) {
	return new Promise((resolve, reject) => {
		// Merge the user config with our defaults
		const updatedConfig = getInstallerConfig(configs);
		// Validate the config with our schema
		Joi.validate(updatedConfig, installerSchema, (err, value) => {
			if (err) return reject(err);
			windowsInstaller.createWindowsInstaller(updatedConfig).then(() => {
				resolve();
			}).catch((err) => {
				console.error(err);
				reject(err);
			});
		});
	});
}

// Merge the user config with our defaults
function getInstallerConfig(configs) {
	const newConfig = Object.assign(defaults, configs);
	return newConfig;
}

module.exports = {
	createInstaller
};
