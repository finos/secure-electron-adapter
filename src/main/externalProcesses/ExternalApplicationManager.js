const fs = require('fs');
const EventEmitter = require('events').EventEmitter;
const path = require('path');
const async = require('async');
const download = require('../../common/download');
const unzip = require('unzipper');
const mkdirp = require('mkdirp');
const ExternalApplication = require('./ExternalApplication');
const signtool = require('signtool');
const logger = require('../../logger/')();

/**
 * Manages the downloading and running of "external" applications, in other words, of exe files.
 * These should be specified in the `appAssets` entry of the manifest.
 * Assets are only downloaded once. To force a new download, the `version` should be changed in the appAssets entry.
 * The location of the folder for downloaded assets can be specified in the manifest under `externalAssets.assetsFolder`.
 */
class ExternalApplicationManager extends EventEmitter {
	/**
	 *
	 * @param {object} manifestEntry The `externalAssets` manifest entry.
	 */
	constructor(manifestEntry) {
		super();
		this.assets = {};
		this.manifestEntry = manifestEntry;
		if (!fs.existsSync(this.manifestEntry.assetsFolder)) {
			mkdirp.sync(this.manifestEntry.assetsFolder);
		}
		/**
		 * References to external applications processes
		 * e.g. assimilation is an external application.
		 */
		this.activeApplications = [];
	}

	/**
	 * When we get the stream back from download, unzip the asset.
	 */
	_onDownloadStreamReturned(result, asset, done) {
		result
			.pipe(unzip.Extract({ path: asset.path }))
			.on('error', e => this._onUnzipError(e, asset, done))
			.on('close', () => this._onUnzipComplete(asset, done));
	}

	/**
	 * Catches download errors and logs them out.
	 */
	_onDownloadError(e, asset, done) {
		const ERR_MESSAGE = `Error downloading "${asset.alias}" from ${asset.src}. Original Error: ${e}`;
		logger.error(ERR_MESSAGE);
		// Don't return the error to async, because we want to try to download every file, even if one fails.
		done();
	}

	/**
	 * Exit out of this function when we've finished unzipping the asset.
	 */
	_onUnzipComplete(asset, done) {
		const LOG_MESSAGE = `Asset "${asset.alias}" Successfully unzipped to ${asset.path}`;
		logger.info(LOG_MESSAGE);
		done();
	}

	/**
	 * If we fail to unzip (e.g., the folder is empty...), catch the error and log it out.
	 * Delete the folder as well, so FEA will attempt to download the asset again on the next boot.
	 */
	_onUnzipError(e, asset, done) {
		const ERR_MESSAGE = `Error parsing file downloaded for "${asset.alias}" from ${asset.src}. This can be caused by misconfiguration. Make sure the url is configured properly in your manifest file.
		Finsemble will attempt to download the file again when the application restarts.
		Original Error: ${e}`;
		logger.error(ERR_MESSAGE);

		// We remove the empty directory (because it failed to download), so that the app will try to download the app on the next start.
		fs.rmdirSync(asset.path);
		// Don't return the error to async, because we want to try to download every file, even if one fails.
		done();
	}

	/**
	 * Download any asset specified in the appAssets attribute of the manifest.
	 * Before downloading, we check to see if the asset has already been cached.
	 * @param {object} appAssets An appAssets entry from the manifest
	 * @param {function} cb
	 */
	downloadAssets(appAssets, cb) {
		if (!appAssets || appAssets.length === 0) {
			logger.log('No appAssets to load');
			return cb();
		}
		if (!Array.isArray(appAssets)) {
			logger.error('Manifest appAssets entry is not an array', `${typeof appAssets} passed`);
			return cb();
		}


		// Run only one download operation at a time
		return async.mapLimit(appAssets, 1, (asset, done) => {
			// Figure out the location to put our asset
			const assetFolder = path.join(this.manifestEntry.assetsFolder, asset.alias);
			const CHECKING_CACHE_MSG = `Checking ${this.manifestEntry.assetsFolder} for ${asset.alias}`;
			logger.info(CHECKING_CACHE_MSG);

			this.assets[asset.alias] = asset;
			// If the folder doesn't exist, go ahead and create it.
			if (!fs.existsSync(assetFolder)) {
				mkdirp.sync(assetFolder);
			}

			const saveLocation = path.join(assetFolder, asset.version);
			asset.path = saveLocation;

			// If the asset already exists, return early
			if (fs.existsSync(saveLocation)) {
				const SAVE_MSG = `${saveLocation} already exists. Skipping download.`;
				logger.info(SAVE_MSG);
				return done();
			}

			// TODO, show a downloading dialog with progress bar on the screen
			const DOWNLOAD_START_MSG = `Downloading asset "${asset.alias}" from ${asset.src}.`;
			logger.info(DOWNLOAD_START_MSG);

			// Create the location and then download the asset
			mkdirp.sync(saveLocation);

			download(asset.src, { returnStream: true })
				.then(result => this._onDownloadStreamReturned(result, asset, done))
				.catch(e => this._onDownloadError(e, asset, done));
		}, (err) => {
			if (err) {
				logger.log('Error loading external assets ', err);
			} else {
				logger.log('Done loading external assets.');
			}
			return cb(err);
		});
	}

	/**
	 * Spawns an application
	 * @param {ExternalApplicationParams} params
	 */
	async spawnFile(params) {
		let spawnPath;
		if (params.alias) {
			const asset = this.assets[params.alias];
			if (!asset) {
				throw new Error(`Error in spawnFile, asset not found. ${params.alias} -> ${this.assets}`);
			}
			spawnPath = path.join(asset.path, asset.target);
		}
		if (params.path) {
			spawnPath = params.path;
			logger.debug(`ExternalApplicationManager.spawnFile ${spawnPath}`);
		}

		if (!spawnPath) {
			throw new Error('No path provided for external application. Please provide a valid path.');
		}

		if (!fs.existsSync(spawnPath)) {
			throw new Error(`Provided path does not exist. Please provide a valid path: ${spawnPath}`);
		}
		// trusted indicates we should verify signature on the executable
		if (params.certificate && params.certificate.trusted) {
			try {
				// valid signatures will not throw an error. invalid signatures throw errors.
				await signtool.verify(spawnPath, { defaultAuthPolicy: true });
			} catch (err) {
				logger.error(`Unable to verify signature of ${spawnPath}. ${err.message}`);
				const error = new Error(`Unable to verify signature of ${spawnPath}.`);
				throw (error);
			}
		}

		// @todo verify certificate.serial and certificate.thumbprint using c++ or c#
		// https://support.microsoft.com/en-us/help/323809/how-to-get-information-from-authenticode-signed-executables
		// https://docs.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.x509certificate2?view=netframework-4.7.2

		path.join('', spawnPath); // Ensure the path is in the right format for this operating system


		// Optionally use manifest entry `options` to set child_process options
		// https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
		const options = params.options || {};

		// Set env directly from assets manifest entry
		if (!options.env) options.env = params.env;

		// Change the working directory to the spawn path if it is not already set
		if (!options.cwd) options.cwd = path.dirname(spawnPath);

		if (!params.arguments) {
			// Default to an empty array
			params.arguments = [];
		} else if (typeof (params.arguments) === 'string') {
			// If arguments is a string, split it into an array
			params.arguments = params.arguments.split(' ');
		} else if (!Array.isArray(params.arguments)) {
			// If arguments isn't an array, default to an empty array and print a error.
			logger.warn(`Arguments for ${spawnPath} is not a string or an array, but is ${typeof (params.arguments)}`);
			params.arguments = [];
		}

		logger.log(`Attempting to start external application ${spawnPath} with arguments ${params.arguments} with options ${options}`);

		const externalApp = new ExternalApplication({ path: spawnPath, arguments: params.arguments, options });
		this.activeApplications.push(externalApp);
		return externalApp;
	}
	/**
	 * Iterates through active external apps and invokes the close method on each.
	 */
	closeAllApps() {
		this.activeApplications.forEach(app => app.close());
	}
}

module.exports = ExternalApplicationManager;
