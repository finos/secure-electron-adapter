const electron = require('electron');
const {webFrame, contextBridge, ipcRenderer} = electron;
const Window = require('./render/Window');
const System = require('./render/System');
const WindowProcess = require('./render/WindowProcess');
const logger = require('./logger')();

const currentWindowProcess = WindowProcess.getCurrent();
const currentWindow = currentWindowProcess.window;


// Boolean to prevent multiple window load events from firing.
let loaded = false;

/**
 * Callback is invoked when the SEA API is ready to be interacted with.
 * If the API is ready and this method is called, the callback is immediately
 * invoked. Otherwise we wait for the 'ContainerReady' event to be thrown by the window.
 *
 * @param {Function} [cb] Callback to be invoked when the SEA API is ready to be used.
 * @example
 * sea.onLoad(()=>{
 * 	console.log("I can do anything with the SEA API now.");
 * })
 */
const onLoad = function (cb = Function.prototype) {
	if (loaded) return cb();
	window.addEventListener('ContainerReady', event => cb());
}

// Store promise to ensure all preloads have executed before calling onLoad
let preloadPromise = new Promise((resolve, reject) => {
	ipcRenderer.once("runPreloads-complete",(event, arg) => {
		resolve();
	  })
})

// Function to signal execution of preload scripts
const preloadScripts = function () {
	const requestObject = {
		topic: 'runPreloads'
	};
	ipcRenderer.send('sea.mainRequest', requestObject);
}

/**
 * Event handler for 'window load'.  Preloads any files for this
 * window and triggers any functions waiting for sea.onLoad.
 */
const onWindowLoad = async () => {
	logger.verbose(`In window load event. is window loaded: ${loaded}`);
	// Wait for preloads to complete
	await preloadPromise;
	if (loaded) return;
	// Make sure window.name is correct. Before this is invoked, name is the title.
	webFrame.executeJavaScript(`window.name = sea.getCurrentWindow().name`)
	loaded = true;
	logger.verbose(`${window.name} ContainerReady`);
	const event = new Event('ContainerReady');
	// Will invoke any callbacks that are waiting for sea.onLoad
	window.dispatchEvent(event);
}

if (currentWindow) {

	webFrame.executeJavaScript(`window.name = '${currentWindow.title}'`)

	window.name = currentWindow.title;

	contextBridge.exposeInMainWorld(
		'sea',
		{
			onLoad,
			getCurrentWindow: () => Window.getCurrent(),
			getCurrentWindowProcess: () => WindowProcess.getCurrent(),
			Window,
			WindowProcess,
			System: new System(),
		}
	)

	// window.onload was used previously; users can overwrite window.onload. To prevent that from happening, we wait for the load event. function.
	window.addEventListener('load', onWindowLoad);
	preloadScripts();
} else {
	logger.error('The current window could not be found');
}
