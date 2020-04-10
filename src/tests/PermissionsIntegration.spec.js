/**
 * Integration test to test every possible permission to make sure each exit point was handled
 * In this case real events would be sent around with the MainBus and IPC
 * This could be tricky as we need to determine a way to verify the correct listener is sent to a valid endpoint (ie everything has been hooked up properly)
 *
 * If this is too hard this could become a unit test of the addRestrictedListener function where we only verify the correct thing is returned.
 * In that case there is no need to test every permission possible, just a subset of cases. It would also not handle the cases that use ipc.on to receive responses.
 */
const chai = require('chai');

const expect = chai.expect;

describe('Permissions Integration tests', () => {
	context('Window permission method tests', () => {
		// setup create window with all permissions true
		// create window with all permissions false
		const windowMethods = ['blur', 'bringToFront', 'close', 'closeRequestedAdd', 'closeRequestedRemove',
			'createWindowWithAffinity', 'executeJavaScript', 'focus', 'forceClose',
			'getBounds', 'getDetails', 'getOptions', 'getParentApplication',
			'getState', 'hide', 'isShowing', 'maximize', 'minimize',
			'reload', 'removeListener', 'restore',
			'setBounds', 'setZoomLevel', 'syncWindowInfo', 'show', 'showAt', 'showDeveloperTools', 'updateOptions'];
		// add listeners with PermissionsManager.addRestrictedListener
		// send request to listener
		// verify access denied is returned
		windowMethods.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		windowMethods.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
			// add tests for methods that don't use PermissionsManager.addRestrictedListener
		});
	});
	context('Window permission addListener tests', () => {
		const windowListeners = [];
		windowListeners.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		windowListeners.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
		});
	});
	context('WindowProcess permission method tests', () => {
		const applicationMethods = [];
		applicationMethods.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		applicationMethods.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
		});
	});
	context('WindowProcess permission addListener tests', () => {
		const applicationListeners = [];
		applicationListeners.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		applicationListeners.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
		});
	});
	context('System permission method tests', () => {
		const systemMethods = [];
		systemMethods.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		systemMethods.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
		});
	});
	context('System permission addListener tests', () => {
		const systemListeners = [];
		systemListeners.forEach((value) => {
			it(`should return accessDenied when permission for ${value} is false`);
		});

		systemListeners.forEach((value) => {
			it(`should return a listener that does not contain an error when permission for ${value} is true`);
		});
	});
	after((done) => {
		done();
	});
});
