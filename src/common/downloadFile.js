const download = require('./download');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const logger = require('../logger')();

/**
 * Download a file, recursively make the directory it will be written to if it does not exist.
 *
 *
 * @param {Object} params
 * @param {String} params.toPath - location to write file
 * @param {String} params.fromPath - url to download file data
 * @param {String} params.fileName - name of file to write
 * @param {Function} cb - call cb when file has been written
 */
const downloadFile = async (params = {}, cb = Function.prototype) => {
	if (!fs.existsSync(params.toPath)) {
		mkdirp.sync(params.toPath);
	}
	const fileName = path.join(params.toPath, params.fileName);
	if (!fs.existsSync(fileName)) {
		try {
			const data = await download(params.fromPath);
			fs.writeFileSync(fileName, data);
			logger.debug('download complete ', fileName);
			return cb(null);
		} catch (e) {
			logger.error('Error downloading', fileName, e);

			return cb(e);
		}
	}

	cb();
	return fileName;
};

module.exports = downloadFile;
