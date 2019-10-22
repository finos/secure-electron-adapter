const fs = require('fs');
const path = require('path');
const DEFAULT_CACHE_PATH = require('../main/helpers/getCachePathSync')();
const downloadFile = require('./downloadFile');
const logger = require('../logger/')();

/**
 * If the method is missing required parameters, throw errors.
 */
function validateParams(params) {
	if (typeof params.fileName === 'undefined') {
		throw new Error("Required parameter 'Filename' missing from call to downloadCache.");
	}
	if (typeof params.fromPath === 'undefined') {
		throw new Error("Required parameter 'fromPath' missing from call to downloadCache.");
	}
}
/**
 * Puts in default values for optional parameters
 */
function mergeDefaultParams(params) {
	return {
		fileName: params.fileName,
		fromPath: params.fromPath,
		cachePath: typeof params.cachePath === 'undefined' ? DEFAULT_CACHE_PATH : params.cachePath,
		invalidateCache: typeof params.invalidateCache === 'undefined' ? false : params.invalidateCache,
	};
}

/**
 * Delets a file. This will be invoked if the routine is passed in 'invalidateCache: true'.
 */
function deleteCachedFile(filePath) {
	const deleteCachedFilePromiseResolver = (resolve, reject) => {
		fs.unlink(filePath, (err) => {
			if (err) {
				reject(err);
				throw err;
			}
			resolve();
		});
	};
	return new Promise(deleteCachedFilePromiseResolver);
}

/**
 * Whether a file exists on the file system.
 */
function fileExists(filePath) {
	const fileExistsPromiseResolver = (resolve) => {
		// Checks to see if we can read the file
		fs.access(filePath, fs.constants.F_OK, (e) => {
			// If the error exists, the file does not.
			resolve(!e);
		});
	};

	return new Promise(fileExistsPromiseResolver);
}

/**
 * Downloads a file if it isn't found in the cache.
 * @param {object} params
 * @param {String} params.fileName - name of file to write
 * @param {URL} params.fromPath URL to download the file from if it is not found in the cache.
 * @param {string} [params.cachePath] Optional path to cache the file after download. Will also be used when checking the cache initially.
 * @param {boolean} [params.invalidateCache]=false Optional parameter to invalidate the cached file.
 * @param {*} cb
 */
const downloadCache = async function (params = {}, cb = Function.prototype) {
	try {
		validateParams(params);
	} catch (e) {
		return cb(e, null);
	}
	const parameters = mergeDefaultParams(params);

	const localFilePath = path.join(parameters.cachePath, parameters.fileName);

	const alreadyCached = await fileExists(localFilePath);
	// If we are not invalidating the cached file and the file
	// is already cached, go ahead and return the location.
	if (!parameters.invalidateCache && alreadyCached) {
		logger.info('File retrieved from cache', localFilePath);
		return cb(null, localFilePath);
	}

	// If we should invalidate the cache, delete the file
	if (parameters.invalidateCache && alreadyCached) {
		try {
			// if the file doesn't exist or something else happens, it'll throw an error. We return at that point.
			await deleteCachedFile(localFilePath);
		} catch (e) {
			return cb(e, null);
		}
	}

	// Download the file and return the path
	return downloadFile({
		toPath: parameters.cachePath,
		fileName: parameters.fileName,
		fromPath: parameters.fromPath,
	}, (e) => {
		cb(e, localFilePath);
	});
};

module.exports = downloadCache;
