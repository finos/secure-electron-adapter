const { app, session } = require('electron');
const sea = require('./src/exports');
const superagent = require('superagent');
const path = require('path');
const logger = require('./src/logger')();
const MANIFEST_URL = 'http://localhost:3375/configs/application/manifest-local.json';

try {
	const rawFlags = process.env.chromiumFlags ? process.env.chromiumFlags : '{}';
	const chromiumFlags = JSON.parse(rawFlags);
	const keys = chromiumFlags ? Object.keys(chromiumFlags) : [];
	keys.forEach(key => {
		logger.info(`Appending chromium flags switch. Key: ${key}, Value: ${chromiumFlags[key]}`);
		app.commandLine.appendSwitch(key, chromiumFlags[key])
	});
} catch (error) {
	logger.warn(`Unable to set chromium flags: ${error}. Continuing startup.`);
}

// https://docs.microsoft.com/en-us/windows/desktop/shell/appids
// Causes the multiple electron apps/windows to be grouped together under a single windows taskbar icon.
app.setAppUserModelId('sea');
// Only used if you turn on updates. You'll need to comment out the updater code below
// const updater = null;
process.on('uncaughtException', (error) => {
	logger.error('error', error);
});

// Affects affinity.  See https://github.com/electron/electron/issues/18397
app.allowRendererProcessReuse = false;

// Before the Electron app is ready, set the directory path for storing the app's configuration files (cache, indexedDB, etc)
const userDataPath = path.join(app.getPath('appData'), app.name, 'userdata');
app.setPath('userData', userDataPath);

app.on('ready', () => {
	logger.log('APPLICATION LIFECYCLE: Electron app ready.');
	session.defaultSession.allowNTLMCredentialsForDomains('*');
	getManifest((err, manifest) => {
		if (err) {
			logger.error(`FATAL: Could not retrieve manifest ${err.message}`);
			return app.exit();
		}
		sea.seaApplication(app, manifest);
	});
});


function getManifest(cb) {
	logger.debug('devIndex->getManifest: Retrieving Manifest');
	const options = {};
	for (let j = 0; j < process.argv.length; j++) {
		if (process.argv[j] === '--manifest') options.manifest = process.argv[j + 1];
		logger.debug(`devIndex->getManifest. Processing argv. ${j} -> ${process.argv[j]}`);
	}
	let manifestUrl = options.manifest;
	if (!manifestUrl) manifestUrl = MANIFEST_URL;
	getManifestFromUrl(manifestUrl, cb);
}

function getManifestFromUrl(manifestUrl, cb) {
	logger.info(`devIndex->getManifestFromUrl. Using manifest URL: ${manifestUrl}`);
	superagent
		.get(manifestUrl)
		.send()
		.set('accept', 'json')
		.end((err, res) => {
			if (err) {
				logger.error(`Error retrieving manifest: ${err.message || err}`);
				// @todo should we return an error in the callback? Why would superagent return an error?
				return;
			}
			try {
				const fullManifest = JSON.parse(res.text);
				logger.info(`Manifest: ${res.text}`);
				return cb(null, fullManifest);
			} catch (err) {
				logger.error('Error starting app.', err.message);
				return cb(err);
			}
		});
}


