let e2oLauncher;
const { dialog } = require('electron');
const logger = require('./logger')();
const path = require('path');
try {
	e2oLauncher = require('../startup/e2oLauncher');
} catch (err) {
	logger.error(err.message);
	e2oLauncher = {};
}

const e2oExport = {

	/** @todo
	 * need:
	 *  debug port
	 * inspect port
	 * inspect break
	 * inspect
	 * add args
	 */
	// Used this to open up e2o locally without an installer
	e2oLauncher: (params, cb = Function.prototype) => e2oLauncher(params, cb),
	// This is used when actually creating an e2o application. It is our main wrapper around electron
	e2oApplication: (app, manifest) => {
		try {
			const e2o = require("./main/Main");
			e2o.init(app, manifest);
		} catch (err) {
			logger.error(`${err.message}`);
			dialog.showErrorBox('Error in e2oApplication', err.message);
		}
	}
};


module.exports = e2oExport;
