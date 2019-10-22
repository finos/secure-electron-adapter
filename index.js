const { app, dialog, session } = require('electron');
const e2o = require('./exports');
// This handles our auto update process
const E2OUpdater = require('./deploy/startup/E2oUpdater');
const logger = require('./src/logger/')();
const superagent = require('superagent');
const fs = require('fs');
const handleSquirrelEvents = require('./deploy/startup/setupEvents');
const path = require('path');

try {
	const rawFlags = fs.readFileSync(path.join(__dirname, './deploy/configs/chromiumFlags.json'));
	const chromiumFlags = JSON.parse(rawFlags);
	const keys = chromiumFlags ? Object.keys(chromiumFlags) : [];
	keys.forEach(key => app.commandLine.appendSwitch(key, chromiumFlags[key]));
} catch (error) {
	logger.warn(`Unable to set chromium flags: ${error}. Continuing startup.`);
}
// https://docs.microsoft.com/en-us/windows/desktop/shell/appids
// Causes the multiple electron apps/windows to be grouped together under a single windows taskbar icon.
app.setAppUserModelId('e2o');

let updater = null;
process.on('uncaughtException', (error, origin) => {
	logger.error(`indexjs->Uncaught exception ${error.message} origin ${origin}`);
});

/**
 * This will either get a manifest from command line arguments or use the defrault url from above
 * @param {*} cb
 */
function getManifestUrl(cb) {
	logger.debug('index->getManifestUrl');
	let manifestUrl;
	try {
		const config = fs.readFileSync(path.join(__dirname, './deploy/configs/manifestLocation.json'));
		manifestUrl = JSON.parse(config).manifestUrl;
	} catch (e) {
		dialog.showErrorBox('Unable to find manifest', 'Please recreate your installer');
		process.exit(1);
		return;
	}
	logger.debug('index->getManifestUrl. Found manifest URL:', manifestUrl);
	getManifestFromUrl(manifestUrl, cb);
}

/**
 * download the manifest from a url
 * @param {*} manifestUrl
 * @param {*} cb
 */
function getManifestFromUrl(manifestUrl, cb) {
	logger.info(`devIndex->getManifestFromUrl. Using manifest URL: ${manifestUrl}`);
	superagent
		.get(manifestUrl)
		.send()
		.set('accept', 'json')
		.end((err, res) => {
			if (err) {
				const msg = err.message || err;
				logger.error(`Failed to retrieve manifest ${msg}`);
				dialog.showErrorBox('Error fetching manifest', msg);
				return;
			}
			try {
				const fullManifest = JSON.parse(res.text);
				logger.info(`index->getManifestFromUrl. Full manifest: ${res.text}`);
				return cb(null, fullManifest);
			} catch (err) {
				const msg = err.message || err;
				logger.error(`App failed to start ${msg}`);
				dialog.showErrorBox('Error starting application', msg);
				return cb(err);
			}
		});
}

// The installer will do some things here. If it needs to, it will return true and quit the app.(updates...)
// @todo implement updates.
const updateFound = handleSquirrelEvents(app);

if (!updateFound) {
	// When electron is ready get the manifest and start e2o
	app.on('ready', () => {
		logger.log('APPLICATION LIFECYCLE: Electron app ready.');
		session.defaultSession.allowNTLMCredentialsForDomains('*');
		// This flag is set when we start from npm. Look at the package.json
		if (!process.env.ELECTRON_DEV) {
			try {
				const config = fs.readFileSync(path.join(__dirname, './deploy/configs/updateLocation.json'));
				// Only do this if in the installer.  Feed is the server path to check for new files. Look at electron autoupdater for more info.
				const FEED_URL = JSON.parse(config).updateFeedUrl;
				if (FEED_URL) {
					updater = new E2OUpdater(FEED_URL);
				} else {
					logger.warn(`No update feed URL found. This application will not update. Please make sure server-environment-startup.json => ${environment} has a value for 'updateFeedUrl`);
				}
			} catch (e) {
				logger.error('Unable to find updateLocation.json in deployed e2o. Ensure that e2opackager.setUpdateURL was called when making the package.');
			}
		}

		getManifestUrl((err, manifest) => {
			if (err) {
				logger.error(`Unable to get manifest url ${err.message}`);
				dialog.showErrorBox('GetManifestUrl error', err.message);
				return app.exit();
			}

			e2o.e2oApplication(app, manifest);
		});
	});
}
