const EventEmitter = require('events').EventEmitter;
const {
	dialog, screen, powerMonitor, session
} = require('electron');
const path = require('path');
const ExternalApplicationManager = require('./externalProcesses/ExternalApplicationManager');
const ApplicationManager = require('./ApplicationManager');
const MainBus = require('./MainBus');
const IAC = require('../IAC/Transport');
const MainSystem = require('./MainSystem');
const getFlag = require('../common/getFlag');
const windowStore = require('../common/helpers/windowsStore');
const logger = require('../logger/')();
const PermissionsManager = require('../permissions/PermissionsManager');
const { clearPreloadCache } = require('../common/helpers');
const CSPParser = require('../common/helpers/cspParser');
const appData = require('./helpers/getAppDataFolderSync')();

const options = {};
const manifest = getFlag('--manifest');
const setupRemoteModuleSecurity = require('./security/remoteModuleSecurity/setupRemoteModuleSecurity');
// The default value of the Content-Security-Policy key.
const DEFAULT_CSP = 'respect-server-defined-csp';
// The name of the content security policy key
const CSP_KEY_NAME = 'Content-Security-Policy';
const { isValidURL, getFilenameTrustedPreloadDeprecationWarning } = require('../common/helpers');

if (manifest) {
	options.manifest = manifest;
}
class Main extends EventEmitter {
	constructor() {
		super();
		this.IAC = null;
		this.app = null;
		this.assimConnection;
		global.preload = {};
		this.bindMethods();
	}

	/**
	 * Bind methods to `this` to keep in the same context.
	 * @returns {void}
	 */
	bindMethods() {
		this.startIAC = this.startIAC.bind(this);
		this.onHeadersReceived = this.onHeadersReceived.bind(this);
		this._onWebContentsCreated = this._onWebContentsCreated.bind(this);
		this._onNewWindowHandler = this._onNewWindowHandler.bind(this);
		this._onBeforeRequest = this._onBeforeRequest.bind(this);
	}

	/**
	 * This will initialize the Electron application
	 * @param {Electron App} app
	 * @param {object} manifest Optional, for unit tests
	 */
	init(app, manifest) {
		if (manifest) {
			options.manifest = manifest;
		}

		if (!options.manifest) {
			logger.error('FATAL: No manifest provided. Exiting the application.');
			dialog.showErrorBox('Unavailable Manifest', 'FATAL: No manifest provided to init.');
			process.exit(1);
		}
		this.manifest = manifest;
		// Set the minimum logging level
		const loggerConfig = this.manifest['secure-electron-adapter'] || { logger: {} };
		if (loggerConfig.logger && loggerConfig.logger.logLevel) {
			logger.setLevel(loggerConfig.logger.logLevel);
		}
		// delete preload cache when electron starts
		clearPreloadCache();
		this.app = app; // Store the app here for reference
		this.startApp = this.startApp.bind(this);
		// Start the main application
		this.system = new MainSystem(this.app);
		this._addWebContentsCreatedHandler();
		this.validateTrustedPreloadArray();
		this.internalListeners();
		this.startApp();
		setupRemoteModuleSecurity(app);
	}

	/**
	 * Warns user if they have provided a filename as a trusted preload in their config.
	 *
	 * @memberof Main
	 */
	validateTrustedPreloadArray() {
		logger.debug('Main->validateTrustedPreloadArray');
		// @todo pull electronAdapter out of this.manifest.electronAdapter and remove the first check.
		// this.manifest.electronAdapter should always exist..
		if (this.manifest.electronAdapter
			&& Array.isArray(this.manifest.electronAdapter.trustedPreloads)) {
			this.manifest.electronAdapter.trustedPreloads.forEach((preload) => {
				if (!isValidURL(preload)) {
					// this makes it red.
					logger.warn(getFilenameTrustedPreloadDeprecationWarning(preload));
				}
			});
		}
	}

	/**
	 * Adds app 'web-contents-created' event handler to-
	 * intercept window creation and webview attachment to DOM.
	 * Modifies webPreferences to make sure nodeIntegration is disabled
	 * and delete any unwanted security-related webPreferences properties
	 * @private
	 */
	_addWebContentsCreatedHandler() {
		this.app.on('web-contents-created', this._onWebContentsCreated);
	}

	/**
	 * A listener invoked when the this.app emits 'web-contents-created'
	 * @param {object} event The contents created event
	 * @param {object} contents BrowserWindow.webContents
	 * @private
	 */
	_onWebContentsCreated(event, contents) {
		logger.debug('Main->_onWebContentsCreated');
		// Before sending HTTP(S) requests.
		const { session } = contents;
		if (session && session.webRequest) {
			session.webRequest.onBeforeRequest([], this._onBeforeRequest);
		}
		// When attaching a webview, disable preload, preloadURL and nodeIntegration
		contents.on('will-attach-webview', this._onWillAttachWebViewHandler);
		// When attempting to create a new window
		contents.on('new-window', this._onNewWindowHandler);
	}

	/**
	 * 	Invoked when 'will-attach-webview' is emited any BrowserWindow
	 * @param {object} event will attach webview event
	 * @param {*} webPreferences The web preferences of the webview
	 * @param {*} params object
	 * @returns {object}
	 * @private
	 */
	_onWillAttachWebViewHandler(event, webPreferences, params) {
		// @todo see if we can get name of the window
		logger.debug('Main->_onWillAttachWebViewHandler.');
		if (webPreferences.nodeIntegration) {
			logger.warn('Disabling node Integration in web view');
		}
		// Strip away preload scripts
		delete webPreferences.preload;
		delete webPreferences.preloadURL;
		// Disable Node.js integration
		webPreferences.nodeIntegration = false;
		// Return so that we can test the above overrides
		return webPreferences;
	}

	/**
	 * Invoked when 'new-window' event is emited by any BrowserWindow
	 * @param {object} event The window.open event
	 * @param {string} url The url to open
	 * @param {string} frameName The frame name
	 * @param {string} disposition Disposition of window
	 * @param {object} options BrowserWindow options
	 */
	_onNewWindowHandler(event, url, frameName, disposition, options = {}) {
		logger.debug('main->_onNewWindowHandler', url);
		let aboutURL;
		try {
			aboutURL = new URL(url);
		} catch (err) {
			return logger.error(`Failed to create new browser window: Invalid URL ${url}`);
		}
		if (aboutURL.protocol === 'chrome-devtools:') {
			// If the window is a chrome console, just ignore and return.
			return;
		}
		event.preventDefault();
		// @todo This is a workaround that doesn't break window.open but doesn't bring that window into the fold.
		process.applicationManager.spawnWithAffinityRequest({
			data: {
				affinity: frameName,
				windowName: frameName,
				url,
				autoShow: true
			},
			respond: Function.prototype
		});
	}

	/**
	 * Invoked before any http(s) request
	 * @param {object} request The http request.
	 * @param {function} callback
	 * @private
	 * @returns {void}
	 * */
	async _onBeforeRequest(request, callback) {
		logger.verbose('main->_onBeforeRequest', request.url);
		const localhostRegex = /^https?:\/\/localhost:\d+/i;
		const devtools = /^chrome-devtools.*/i;

		const { feaURLWhitelist } = this.manifest.electronAdapter;
		const { url } = request;
		let cancel = false;
		// Ignore when its a local electronAdapter request
		if (devtools.test(url) || localhostRegex.test(url)) {
			return callback({});
		}
		// Care only about mainFrame requests for now
		if (request.resourceType !== 'mainFrame') {
			return callback({});
		}
		// Here we decide whether we need to cancel the
		// request or not based on our given regex
		if (feaURLWhitelist) {
			try {
				cancel = !this._isPermittedURL(feaURLWhitelist, url);
			} catch (error) {
				logger.error(`Invalid feaURLWhitelist: ${error.message}`);
			}
		}

		// Log a message in logger if this was a restricted url
		cancel && logger.warn(`Restricted access to url: ${url}`);
		// We are done, continue or cancel request
		callback({
			cancel
			// redirectURL: cancel ? 'http://localhost:3375/components/welcome/welcome.html' : null
		});
	}

	/**
	 * Gets a manifest entry given an object chain in string form. If the object chain doesn't exist, then null will be returned.
	 * @param {string} chain
	 * @example
	 * getManifestEntry("electronAdapter.foo.bar");
	 */
	getManifestEntry(chainString) {
		logger.verbose('main->getManifestEntry', chainString);
		const chain = chainString.split('.');
		// @todo: refactor this function to use lodash.get
		let obj = this.manifest;
		for (let i = 0; i < chain.length; i++) {
			if (!obj) {
				logger.warn('getManifestEntry returned null because this.manifest is not defined.');
				return null;
			}
			obj = obj[chain[i]];
		}
		return obj;
	}

	/**
   * Starts Inter-Application Communication. host, port and secure are derived from the manifest entry if available.
   * electronAdapter.IAC.serverAddress
   */
	startIAC() {
		if (this.IAC) {
			logger.log('IAC already started, no need to restart');
			return; // If IAC is already defined (like after a restart), we don't need to spin it up again.
		}
		logger.log('APPLICATION LIFECYCLE: Starting the IAC');
		let address = this.getManifestEntry(
			'electronAdapter.router.transportSettings.FinsembleTransport.serverAddress'
		);
		if (!address) {
			address = this.getManifestEntry('electronAdapter.IAC.serverAddress');
		}
		if (!address) {
			address = '';
			logger.warn('Did not find serverAddress for IAC in the manifest.');
		}
		const arr = address.split(':');
		const protocol = arr[0];
		let host = arr[1];
		const port = arr[2];
		let options = null;
		// take off the slashed that came from split("wss://host");
		if (host && host.substring(0, 2) == '//') host = host.substring(2);

		// If "ws" is explicitly set then force the IAC to run insecure
		if (protocol === 'ws') {
			options = { secure: false };
		}
		this.IAC = new IAC(port, host, options);
		this.IAC.connect();
	}

	/**
	 * Perform any work necessary to start application
	 * load manifest from url
	 * display splash screen
	 * create external application manager
	 * download any assets for external applications
	 * start IAC
	 * create MainSystem
	 * create our first application using application manager
	 *
	 * @return undefined
	 */
	startApp() {
		const manifest = this.manifest;
		logger.debug('main->startApp');
		const splashScreenImage = this.getManifestEntry('splashScreenImage');
		if (splashScreenImage) {
			const manifestTimeout = this.getManifestEntry('splashScreenTimeout');
			ApplicationManager.showSplashScreen(splashScreenImage, manifestTimeout)
				.catch(err => logger.error(`Unable to load splash screen ${err}`));
		}

		// https://docs.microsoft.com/en-us/windows/desktop/shell/appids
		this.app.setAppUserModelId(this.getManifestEntry('startup_name.name') || 'e2o');
		this.app.manifest = manifest;
		// Set up the external application manager and then download any required assets
		const externalAssetsEntry = this.getManifestEntry('externalAssets') || {};
		if (!externalAssetsEntry.assetsFolder) {
			externalAssetsEntry.assetsFolder = path.join(appData, 'e2o', 'assets');
		}
		logger.log(`Setting externalAssetsFolder to: ${externalAssetsEntry.assetsFolder}`);

		this.app.externalApplicationManager = new ExternalApplicationManager(externalAssetsEntry);

		logger.log('APPLICATION LIFECYCLE: Preparing to download assets');
		// @todo make async/wait. No need for this cb pyramid
		this.app.externalApplicationManager.downloadAssets(this.getManifestEntry('appAssets'), () => {
			logger.log('APPLICATION LIFECYCLE: Successfully downloaded assets');
			this.startIAC();

			// set default permissions on the PermissionsManager
			PermissionsManager.setDefaultPermissions(manifest.electronAdapter.permissions);
			ApplicationManager.setManifest(manifest);

			logger.log(`APPLICATION LIFECYCLE: Starting main application ${manifest.startup_app.name}`);
			ApplicationManager.createApplication(manifest.startup_app, manifest, null, (err, res) => {
				if (err) logger.error(`Failed to start main application ${err}`);
				logger.log('APPLICATION LIFECYCLE: Main application started.');
			});
		});
		this.setContentSecurityPolicy();
		this.setupChromePermissionsHandlers();
	}

	/**
	 * Registers an electron defaultSession.webRequest.onHeadersReceived handler.
	 * @returns {void}
	 */
	setContentSecurityPolicy() {
		session.defaultSession.webRequest.onHeadersReceived(this.onHeadersReceived);
	}

	/**
	 * When a browser makes a chrome permission request, checks to see what permissions the window has allowed/denied.
	 * @returns {void}
	 */
	setupChromePermissionsHandlers() {
		session
			.defaultSession
			.setPermissionRequestHandler(async (webContents, permission, callback) => {
				// Get the window and check to see if it's allowed to do something (e.g., geolocation, notifications).
				const win = await ApplicationManager.findWindowById(webContents.id);
				const permissionAllowed = PermissionsManager.checkPermission(win, `Window.chromePermissions.${permission}`);
				if (!permissionAllowed) {
					logger.warn('Permission disallowed. Permission:', permission, 'URL:', webContents.getURL());
				}
				callback(permissionAllowed);
			});
	}

	/**
	 * Invoked when headers are received. Modifies responseHeaders to update CSP
	 * Matt believes that CSP work on the 1st-defined principle.
	 * So if the system says 'don't do this' but the component says 'do this', it will not do this.
	 * @param {object} details The response headers
	 * @param {function} callback Callback to be invoked when headers received.
	 * @returns {void}
	 */
	onHeadersReceived(details, callback) {
		logger.verbose('main->onHeadersReceived');
		// Get the application wide CSP value from the manifest
		const appSecurityPolicy = this.manifest[CSP_KEY_NAME];
		const responseHeaders = {
			...details.responseHeaders
		};
		// We probably want to modify the CSP, now sure if this goes here
		// or after other modifications below.
		this.modifySecurityDirectives(responseHeaders);
		// If the Content-Security-Policy is actually set and it doesn't
		// Have our default value which is respect-server-defined-csp
		if (appSecurityPolicy && appSecurityPolicy !== DEFAULT_CSP) {
			logger.debug(`main->onHeadersReceived: changing headers from ${responseHeaders[CSP_KEY_NAME]} to ${appSecurityPolicy}`);
			responseHeaders[CSP_KEY_NAME] = appSecurityPolicy;
		}
		// Get the component/window object
		const component = windowStore.getAll()
			.find((component, index) => {
				try {
					return (new URL(component.url)).host === (new URL(details.url)).host;
				} catch (err) {
					logger.warn(`onHeadersReceived: Either the request or the saved component had an invalid url:
					 request.url: ${details.url}, savedComponent.url	${component.url}`);
					return false;
				}
			});
		// Content-Security-Policy in manifest takes priority over component CSP.
		// The check below: if we found the component and component has a CSP
		// and there is no CSP in manifest or manifest's CSP set to respect server defined
		// then we use the CSP from component, otherwise we're using manifest's CSP
		// Note: The following works whenever CSP is set in components.json and
		// does not work when using Clients.LauncherClient.spawn
		if (component && component[CSP_KEY_NAME] && component[CSP_KEY_NAME] !== DEFAULT_CSP
			&& (!appSecurityPolicy || appSecurityPolicy === DEFAULT_CSP)) {
			logger.debug(`main->onHeadersReceived: changing headers from ${responseHeaders[CSP_KEY_NAME]} to ${component[CSP_KEY_NAME]}`);
			responseHeaders[CSP_KEY_NAME] = component[CSP_KEY_NAME];
		}

		callback({
			responseHeaders
		});
	}

	/**
	 * Modifies the CSP if allowEvalInPreload is true by
	 * deleting unsafe-eval and script-src directives'.
	 * @param {String|Array} responseHeaders Headers.
	 * @returns {void}
	 * @private
	 */
	modifySecurityDirectives(responseHeaders) {
		const raw = responseHeaders[CSP_KEY_NAME];
		// Sometimes csp is an array and sometimes is a string, weird.
		const csp = new CSPParser(Array.isArray(raw) ? raw[0] : raw);
		if (csp.has('unsafe-eval') || csp.has('script-src')) {
			if (this.manifest.allowEvalInPreload) {
				logger.warn('unsafe-eval|script-src in CSP, deleting the directives', responseHeaders.url);
				// Update the CSP value after deleting the above directives
				responseHeaders[CSP_KEY_NAME] = csp
					.delete('unsafe-eval')
					.delete('script-src')
					.toString();
			}
		}
	}

	/**
	 * Test the passed url against the passed regex pattern.
	 * This fuction throws if the passed regex string is invalid.
	 * @private
	 * @param {string} pattern RegExp pattern string.
	 * @param {string} url The URL href.
	 * @returns {boolean}
	 */
	_isPermittedURL(pattern, url) {
		const regex = new RegExp(pattern);
		return regex.test(url);
	}

	/**
	 * move this to monitor file
	 */
	internalListeners() {
		screen.addListener('display-added', (event, newDisplay) => {
			logger.log('APPLICATION LIFECYCLE: Monitor added.');
			MainBus.sendEvent('systemEvent.monitor-info-changed');
		});

		screen.addListener('display-removed', (event, oldDisplay) => {
			logger.log('APPLICATION LIFECYCLE: Monitor removed.');
			MainBus.sendEvent('systemEvent.monitor-info-changed');
		});

		screen.addListener('display-metrics-changed', (event, display, changeMetrics) => {
			logger.log('APPLICATION LIFECYCLE: Monitor display metrics changed.');
			MainBus.sendEvent('systemEvent.monitor-info-changed');
		});

		powerMonitor.on('lock-screen', () => {
			logger.log('APPLICATION LIFECYCLE: System locked.');
			MainBus.sendEvent('systemEvent.session-changed');
		});

		powerMonitor.on('unlock-screen', () => {
			logger.log('APPLICATION LIFECYCLE: System unlocked.');
			MainBus.sendEvent('systemEvent.session-changed');
		});

		PermissionsManager.addRestrictedListener('restartE2O', this.startApp); // nothing sends this event
	}
}
const main = new Main();
// for debugging.
process.MainApplication = main;
module.exports = main;
