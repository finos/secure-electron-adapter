const fs = require('fs');
const path = require('path');
// Because these methods can be pulled into the render or main proc, we do not use the instantiated logger (lest node cache it).
// Instead, we get the proper logger each time we run the method.
const getLogger = require('../logger/');

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
	const appData = require('../main/helpers/getAppDataFolderSync')();
	return path.join(appData, 'e2o', folder);
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
 * Checks if the accessDenied callback or error text responded to an event
 * If so, log an error
 * Returns true or false in case the calling function needs to do more gating
 * Currently this function is only used to check permission results.
 * @param {*} response
 */
const checkAndLogAccessDenied = (response) => {
	const localLogger = getLogger();
	if (typeof response === 'object' && response && response.error) {
		console.log('Warning:', response.message);
		localLogger.warn('Warning:', response.message);
		return true;
	} if (typeof response === 'string' && response.includes('api_access_denied')) {
		console.log('Warning:', response);
		localLogger.warn('Warning:', response);
		return true;
	}
	return false;
};

/**
 * Sets a cookie on the provided session
 *
 * @param {Session} ses
 * @param {Object} cookie
 */
const setCookie = (ses, cookie) => new Promise(resolve => ses.cookies.set(cookie, (err, result) => {
	resolve();
}));

/**
 * return cookies from session or empty array
 *
 * @param {Session} session
 * @return {Array} cookies
 */
const getCookies = session => new Promise((resolve) => {
	session.cookies.get({}, (err, cookies) => {
		if (err) {
			console.log('Failed to get cookie', err);
			return resolve([]);
		}
		resolve(cookies);
	});
});

/**
 * builds a Cookie header from the provided session
 *
 * @param {Session} session
 * @return {String} cookie header
 */
const getCookieHeader = async (session) => {
	const cookies = await getCookies(session);
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


module.exports = {
	deleteFolderRecursive,
	clearPreloadCache,
	getFolderLocation,
	accessDenied,
	checkAndLogAccessDenied,
	isBoolean,
	getCookies,
	getCookieHeader,
	setCookie,
	isValidURL,
	getFilenameTrustedPreloadDeprecationWarning,
	getFilenameFromURL
};
