let deploy;
let e2oLauncher;
const { dialog } = require('electron');
const logger = require('./logger')();
/**
The try catches here are becuase we don't have these files when we create the installer. We need to catch the errors and fail silently.
*/
try {
	deploy = require('../deploy/deploymentHelpers');
} catch (err) {
	logger.error(err.message);
	deploy = {};
}
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
	// Create a package and installer for electron applications
	packager: deploy,
	// This is used when actually creating an e2o application. It is our main wrapper around electron
	e2oApplication: (app, manifest) => {
		try {
			const e2o = require('./main/Main');
			e2o.init(app, manifest);
		} catch (err) {
			logger.error(`Failed to require deploymentHelpers ${err.message}`);
			dialog.showErrorBox('Error in e2oApplication', err.message);
		}
	}
};


module.exports = e2oExport;
