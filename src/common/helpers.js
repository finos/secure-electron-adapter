const fs = require('fs');
const path = require('path');
const getLogger = require('../logger/');

const CommonConfig = require('./helpers/Config.js');

const deleteFolderRecursive = (path) => {
	// https://geedew.com/remove-a-directory-that-is-not-empty-in-nodejs/
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach((file, index) => {
			const curPath = `${path}/${file}`;
			if (fs.lstatSync(curPath).isDirectory()) {
				// recurse
				deleteFolderRecursive(curPath);
			} else {
				// delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};

/**
 * Can only be used in the main process.
 */
const clearPreloadCache = async () => {
	const logger = getLogger();
	logger.debug('helpers->clearPreloadCache');
	// If the require is moved outside of the function, it will cause an error.
	// getCachePath calls getAppDataFolder, which assumes it's being run in the main proc.
	const cachePath = require('../main/helpers/getCachePathSync')();
	// Its fair to wrap the deleteFolderRecursive() call with a try/catch
	// block because it uses fs module a lot while any of fs methods could throw
	try {
		deleteFolderRecursive(cachePath);
	} catch (err) {
		logger.error(`Failed to delete preload cache ${cachePath}. err.message`);
	}
};

/**
 * Can only be used in the main process.
 */
const getFolderLocation = async (folder) => {
	// If the require is moved outside of the function, it will cause an error.
	// getAppDataFolder assumes it's being run in the main proc.
	const appData = require('../main/helpers/getAppDataFolderSync').folderPath;
	return path.join(appData, 'sea', folder);
};

/**
 * Function that returns an accessDenied error callback or string including the passed in method name
 * @param {object} methodName
 * @param {*} cb
 */
const accessDenied = (methodName, cb = null) => {
	const errorText = `api_access_denied: Access to API method ${methodName} denied.`;
	if (cb && typeof cb === 'function') {
		return cb({ error: 'api_access_denied', message: errorText });
	}
	return errorText;
};


/**
 * Check if passed in value is a boolean
 * @param {boolean} val
 */
const isBoolean = val => typeof val === 'boolean';


/**
 * Sets a cookie on the provided session
 *
 * @param {Session} ses
 * @param {Object} cookie
 */
const setCookie = async (ses, cookie) => {
	await ses.cookies.set(cookie);
}

/**
 * return cookies from session or empty array
 *
 * @param {Session} session
 * @return {Array} cookies
 */
const getCookies = async (session, hostname) => {
	let filter = {};
	// Restrict preload cookies to ones whose file domain matches the hostname of the URL being requested.
	filter = {domain: hostname};

	try {
		return await session.cookies.get(filter);
	} catch (err) {
		console.log('Failed to get cookie', err);
		return [];
	}
};

/**
 * builds a Cookie header from the provided session
 *
 * @param {Session} session
 * @return {String} cookie header
 */
const getCookieHeader = async (session, hostname) => {
	const cookies = await getCookies(session, hostname);
	return cookies.reduce((result, cookie) => `${result}${cookie.name}=${cookie.value};`, '');
};


/**
 * @returns Boolean whether the URL is valid
 */
const isValidURL = (str) => {
	try {
		const newURL = new URL(str);
		return true;
	} catch (e) {
		return false;
	}
};

const getFilenameFromURL = url => url.substring(url.lastIndexOf('/') + 1);

/**
 * Returns a warning saying that we will deprecate this functionality very soon.
 *
 * @param {*} url
 * @returns
 */
const getFilenameTrustedPreloadDeprecationWarning = function (url) {
	return `Deprecation: URL "${url}" is not a valid URL. Prior
	 to version 3.9.0 filenames were allowed for trusted preloads. In version 4.0, we will only allow absolute URLs for trusted preloads. Please change your url "${url}".`;
};

/**
 * Verify the minimum manifest properties are defined and the correct type.
 * @param {object} manifest
 * @returns null if no errors; otherwise returns an error message
 */
const checkManifestHasRequiredProperties = (manifest) => {

	let errorResponse = null;

	if (!manifest) {
		errorResponse = 'No manifest provided to init.';
	} else if (typeof manifest.main !== 'object') {
		errorResponse = 'Illegal Manifest: manifest.main is not a defined object.';
	} else if (typeof manifest.main.name !== 'string') {
		errorResponse = 'Illegal Manifest: manifest.main.name is not a defined string.';
	} else if (typeof manifest.main.url !== 'string') {
		errorResponse = 'Illegal Manifest: manifest.main.url is not a defined string.';
	} else if (typeof manifest.main.uuid !== 'string') {
		errorResponse = 'Illegal Manifest: manifest.main.uuid is not a defined string.';
	}

	return errorResponse;
}

module.exports = {
	deleteFolderRecursive,
	clearPreloadCache,
	getFolderLocation,
	accessDenied,
	isBoolean,
	getCookies,
	getCookieHeader,
	setCookie,
	isValidURL,
	getFilenameTrustedPreloadDeprecationWarning,
	getFilenameFromURL,
	checkManifestHasRequiredProperties
};
