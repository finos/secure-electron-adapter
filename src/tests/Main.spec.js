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
	// Reassign values before each case
	beforeEach(() => {
		sandbox = sinon.createSandbox();
		Main = require('../main/Main');
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
			startup_app: {},
			finsemble: {
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
	it('_addWebContentsCreatedHandler is called', () => {
		const spy = sandbox.spy(Main, '_addWebContentsCreatedHandler');
		Main.init(app, manifest);
		sinon.assert.calledOnce(spy);
	});
	it('_onWebContentsCreated is invoked on web-contents-created', () => {
		const spy = sandbox.spy(Main, '_onWebContentsCreated');
		Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		sinon.assert.calledOnce(spy);
	});
	it('_onWebContentsCreated is invoked with proper arguments', () => {
		const spy = sandbox.spy(Main, '_onWebContentsCreated');
		Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		sinon.assert.calledWith(spy, event, contents);
	});
	it('_onNewWindowHandler is invoked with arguments / modifies preferences', () => {
		const options = {
			webPreferences
		};
		const spy = sandbox.spy(Main, '_onNewWindowHandler');
		Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		contents.emit('new-window', event, 'http://example.com', 'FakeWindow', null, options);
		sinon.assert.calledWith(spy, event, 'http://example.com', 'FakeWindow', null, options);
	});
	it('_onWillAttachWebViewHandler is invoked with proper arguments, modifies preferences', () => {
		// We expect _onWillAttachWebViewHandler to delete all keys from webPreferences
		// and set nodeIntegration property to false
		const modifiedWebPreferences = {
			nodeIntegration: false
		};
		const spy = sandbox.spy(Main, '_onWillAttachWebViewHandler');
		Main.init(app, manifest);
		Main.app.emit('web-contents-created', event, contents);
		contents.emit('will-attach-webview', event, webPreferences);
		sinon.assert.calledWith(spy, event, webPreferences);
		expect(spy.firstCall.returnValue).to.deep.equal(modifiedWebPreferences);
	});
});
