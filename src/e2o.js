const electron = require('electron');
const fs = require('fs');
const Window = require('./render/Window');
const System = require('./render/System');
const Notification = require('./render/Notification');
const InterApplicationBus = require('./render/InterApplicationBus');
const Application = require('./render/Application');
const remote = electron.remote;
const logger = require('./logger/')();
const messages = require('./common/messages');
/**
 * This allows us to preload dynamic scripts at runtime. Require would always fail.
 * @param {*} url - The full path to the preload script
 */
const dRequire = (url) => {
	const content = fs.readFileSync(url, { encoding: 'utf8' });
	try {
		eval(content);
	} catch (error) {
		console.error(`Failed during executing the preload file: ${url}. ${error.message}`);
	}
};

const currentWindow = remote.getCurrentWindow();
// Boolean to prevent multiple window load events from firing.
let loaded = false;

/**
 * Callback is invoked when the e2o API is ready to be interacted with.
 * If the API is ready and this method is called, the callback is immediately
 * invoked. Otherwise we wait for the 'ContainerReady' event to be thrown by the window.
 *
 * @param {Function} [cb] Callback to be invoked when the e2o API is ready to be used.
 * @example
 * fin.desktop.main(()=>{
	* 	console.log("I can do anything with the e2o API now.");
	* })
	*/
const main = function (cb = Function.prototype) {
	if (loaded) return cb();
	window.addEventListener('ContainerReady', event => cb());
}

const preloadScripts = function () {
	const preloadList = remote.getGlobal('preload')[Window.getCurrent().name];
	if (Array.isArray(preloadList)) {
		preloadList.forEach(p => {
			dRequire(p);
		});
	} else {
		const type = typeof preloadList;
		const context = { type };
		const message = messages('PRELOADS_TYPE_ERROR', context);
		// red output
		console.log('\x1b[31m%s\x1b[0m', message);
	}
}

/**
 * Event handler for 'window load'. preloads any files for this
 * window and triggers any functions waiting for fin.desktop.main.
 */
const onWindowLoad = () => {
	logger.verbose(`In window load event. is window loaded: ${loaded}`);
	if (loaded) return;
	// Make sure window.name is correct. Before this is invoked, name is the title.
	window.name = e2o.desktop.Window.getCurrent().name;
	loaded = true;
	logger.verbose(`${window.name} ContainerReady`);
	const event = new Event('ContainerReady');
	// Will invoke any callbacks that are waiting for fin.desktop.main
	window.dispatchEvent(event);
}

if (currentWindow) {
	window.name = currentWindow.getTitle();

	// This shape allows anyone to run finsemble on top of e2o or openfin with no modification to their code.
	window.e2o = window.fin = {
		// container is used for feature detection in finsemble layer
		container: 'Electron',
		// mimic the shape of the openfin api.
		desktop: {
			main,
			Application,
			InterApplicationBus,
			Notification,
			System: new System({ currentWindow }),
			Window
		}
	};

	// window.onload was used previously; users can overwrite window.onload. To prevent that from happening, we wait for the load event. function.
	window.addEventListener('load', onWindowLoad);
	preloadScripts();
} else {
	logger.error('The current window could not be found');
}
