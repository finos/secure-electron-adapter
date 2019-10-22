/**
 * This file creates an electron package from a given config.
 * We use the resultant package to create an installer for an electron application
 * See the schema or https://github.com/electron-userland/electron-packager/blob/master/docs/api.md for api definitions
 */

const packager = require('electron-packager');
const { serialHooks } = require('electron-packager/hooks');
const Joi = require('joi');
const packageSchema = require('./schemas/packager');
const path = require('path');

let APP_NAME = 'exampleApp';
function getDefaultValues() {
	// See the schema or https://github.com/electron-userland/electron-packager/blob/master/docs/api.md for api definitions
	return {
		afterCopy: [serialHooks([
			(buildPath, electronVersion, platform, arch) => new Promise((resolve, reject) => {
				console.log('Application files copied to tmp directory.');
				resolve();
			})
		])],
		afterExtract: [serialHooks([
			(buildPath, electronVersion, platform, arch) => new Promise((resolve, reject) => {
				console.log('Electron files extracted to tmp directory.');
				resolve();
			})
		])],
		arch: 'x64',
		appVersion: '1.0.0',
		appCategoryType: null,
		asar: true,
		dir: path.join(__dirname, '../'),
		extendInfo: null,
		icon: null,
		ignore: ['../packages'],
		name: APP_NAME,
		out: '../packages',
		overwrite: true,
		platform: 'win32',
		protocols: [{
			name: 'e2o',
			schemas: ['e2o']
		}],
		tmpdir: 'installer-tmp', // The base directory to use as a temp directory. Set to false to disable use of a temporary directory.
		win32metadata: {
			CompanyName: 'ChartIQ',
			FileDescription: APP_NAME,
			OriginalFilename: APP_NAME,
			ProductName: APP_NAME,
			InternalName: APP_NAME,
			'requested-execution-level': null, // https://github.com/electron/node-rcedit
			'application-manifest': null// String path to a local manifest file to use. See here for more details.https://github.com/electron/node-rcedit
		}
	};
}
module.exports = {
	package: async (configs, cb) => new Promise((resolve, reject) => {
		// Merge configs. We may want to move this to a merge package
		if (configs.name) APP_NAME = configs.name;
		const newConfig = Object.assign(getDefaultValues(), configs);
		// Validate the config against our schema
		Joi.validate(newConfig, packageSchema, (err, value) => {
			if (err) {
				console.error('Validation error');
				return reject(err);
			}
			// Every 45 seconds reassure the dev that it's not broken.
			console.log('This may take a while.');
			const reassurer = setInterval(() => {
				console.log('Still working...');
			}, 45 * 1000);
			// Create the package
			packager(value).then((appPaths) => {
				clearInterval(reassurer);
				// This outputs an array of paths. I've only seen one path, the path of the app directory.
				resolve(appPaths);
			}).catch((err) => {
				clearInterval(reassurer);
				reject(err);
			});
		});
	})
};
