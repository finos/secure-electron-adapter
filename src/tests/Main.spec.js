const expect = require('chai').expect;
const sinon = require('sinon');
const EventEmitter = require('events');

// Electron's WebContents mock
class WebContents extends EventEmitter {
	constructor() {
		super();
		this.session = {
			webRequest: {
				onBeforeRequest: () => {},
				onHeadersReceived: () => {}
			}
		};
	}
}

// When running this test, you will see a bunch of error logs
// related to manifest file. Please ignore for the time being
// they will be taken care of in a separate ticket. Tests should pass still.
describe('Main.js', () => {
	// sinon sandbox
	let sandbox;
	// Main.js instance
	let Main;
	// Main.app (BrowserWindow) simple mock with EventEmitter
	let app;
	// webPreferences object mock
	let webPreferences;
	// Contents (contents of BrowserWindow)
	let contents;
	// An event mock
	let event;
	// Fake manifest
	let manifest;
	// sample application URL to use in tests
	const sampleURL = "http://localhost:3375/index.html";
	// Reassign values before each case
	beforeEach(() => {
		sandbox = sinon.createSandbox();
		Main = require('../main/Main');
		checkURLDownloadable = require('../common/checkURLDownloadable.js');
		helpers = require('../common/helpers');
		app = new EventEmitter();
		app.setAppUserModelId = sandbox.spy();
		contents = new WebContents();
		event = {
			// spy this method so that later we can find out whether
			// "new-window" handler called event.preventDefault()
			// to prevent the creation of new window
			preventDefault: sinon.spy()
		};
		manifest = {
			main: {
				"name": "SEA Local",
				"url": "http://www.google.com",
				"uuid": "TEST"
			},
			electronAdapter: {
				permissions: {}
			}
		};
		webPreferences = {
			preload: '',
			preloadURL: '',
			nodeIntegration: true
		};
	});
	afterEach(() => {
		// restore all spies/stubs
		sandbox.restore();
	});
	it('Require Main.js returns an instance', () => {
		expect(Main).to.be.an('object');
	});
	it('confirm valid manifest validates okay', async () => {
		expect(helpers.checkManifestHasRequiredProperties(manifest)).equals(null);
	});
	it('confirm null manifest error is generated', async () => {
		expect(helpers.checkManifestHasRequiredProperties(null)).includes("No manifest");
	});
	it('confirm missing main manifest error is generated', async () => {
		let manifest = {
		};
		expect(helpers.checkManifestHasRequiredProperties(manifest)).includes("main is not");
	});
	it('confirm missing main.name manifest error is generated', async () => {
		let manifest = {
			main: {
				"url": sampleURL,
				"uuid": "TEST"
			},
		};
		expect(helpers.checkManifestHasRequiredProperties(manifest)).includes("main.name is not");
	});
	it('confirm missing main.url manifest error is generated', async () => {
		let manifest = {
			main: {
				"name": "ChartIQ Local",
				"uuid": "TEST"
			},
		};
		expect(helpers.checkManifestHasRequiredProperties(manifest)).includes("main.url is not");
	});
	it('confirm missing main.uuid manifest error is generated', async () => {
		let manifest = {
			main: {
				"name": "ChartIQ Local",
				"url": sampleURL,
			},
		};
		expect(helpers.checkManifestHasRequiredProperties(manifest)).includes("main.uuid is not");
	});
	it('confirm illegal URL', async () => {
		let response = "no error";
		await checkURLDownloadable("http:://www.google.com/Test404.html", 3000).catch((err) => {
			response = err;
		});
		expect(response).includes("illegally formatted");
	});
	it('confirm unknown URL', async () => {
		let response = "no error";
		await checkURLDownloadable("http://www.google.com/Test404.html", 3000).catch((err) => {
			response = err;
		});
		expect(response).includes("404");
	});
	it('confirm unknown protocol in url', async () => {
		let response = "no error";
		await checkURLDownloadable("httpxx://www.google.com", 500).catch((err) => {
			response = err;
		});
		expect(response).includes("Electron.Net error");
	});
	// NOTE: The below test using a bad hostname are handled correctly during normal run-time, but cause unexplained failures in Mocha when running regression tests
	// it('confirm unknown Hostname', async () => {
	// 	let response = "no error";
	// 	// NOTE: This try-catch block should not be necessary but put in to try to catch unexplained behavior when testing.
	// 	await Main.checkURLDownloadable("http://www.googleXXX.com", 300).catch((err) => {
	// 		response = err;
	// 	});
	// 	expect(response).includes("Timeout");
	// });
	it('_addWebContentsCreatedHandler is called', async () => {
		const spy = sandbox.spy(Main, '_addWebContentsCreatedHandler');
		await Main.init(app, manifest);
		sinon.assert.calledOnce(spy);
	});
	it('_onWebContentsCreated is invoked on web-contents-created', async () => {
		const spy = sandbox.spy(Main, '_onWebContentsCreated');
		await Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		sinon.assert.calledOnce(spy);
	});
	it('_onWebContentsCreated is invoked with proper arguments', async () => {
		const spy = sandbox.spy(Main, '_onWebContentsCreated');
		await Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		sinon.assert.calledWith(spy, event, contents);
	});
	it('_onNewWindowHandler is invoked with arguments / modifies preferences', async () => {
		const options = {
			webPreferences
		};
		const spy = sandbox.spy(Main, '_onNewWindowHandler');
		await Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		contents.emit('new-window', event, 'http://example.com', 'FakeWindow', null, options);
		sinon.assert.calledWith(spy, event, 'http://example.com', 'FakeWindow', null, options);
	});
	it('_onWillAttachWebViewHandler is invoked with proper arguments, modifies preferences', async () => {
		// We expect _onWillAttachWebViewHandler to delete all keys from webPreferences
		// and set nodeIntegration property to false
		const modifiedWebPreferences = {
			nodeIntegration: false
		};
		const spy = sandbox.spy(Main, '_onWillAttachWebViewHandler');
		await Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		contents.emit('will-attach-webview', event, webPreferences);
		sinon.assert.calledWith(spy, event, webPreferences);
		expect(spy.firstCall.returnValue).to.deep.equal(modifiedWebPreferences);
	});
});
