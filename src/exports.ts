let seaLauncher: any;
const { dialog } = require('electron');
const logger = require('./logger')();
try {
	seaLauncher = require('../startup/seaLauncher');
} catch (err) {
	logger.error(err.message);
	seaLauncher = {};
}

const seaExport = {

	/** @todo
	 * need:
	 *  debug port
	 * inspect port
	 * inspect break
	 * inspect
	 * add args
	 */
	// Used this to open up sea locally without an installer
	seaLauncher: (params: object, cb = Function.prototype) => seaLauncher(params, cb),
	// This is used when actually creating an sea application. It is our main wrapper around electron
	seaApplication: (app: any, manifest: object) => {
		try {
			const sea = require('./main/Main');
			sea.init(app, manifest);
		} catch (err) {
			logger.error(`Failed to start electron main process ${err.message}`);
			dialog.showErrorBox('Error in seaApplication', err.message);
		}
	}
};


module.exports = seaExport;
