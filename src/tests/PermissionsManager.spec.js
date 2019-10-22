const chai = require('chai');
const { reconcilePermissions, checkPermission } = require('../permissions/PermissionsManager');
const defaultWindowOptions = require('../permissions/defaultWindowOptions');
const { createPermissionObject, addOptionsToPermission } = require('./helpers');

const expect = chai.expect;


// unit tests for the Permissions Manager class
describe('PermissionsManager class', () => {
	// reconcilePermissions(currentPermissions, requestedPermissions)
	context('reconcilePermissions function error handling', () => {
		it('It should return the defaultWindowOptions list if first parameter is empty and the second parameter is always true', () => {
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const returned = reconcilePermissions(null, requestedPermissions);
			expect(returned).to.deep.equal(defaultWindowOptions.permissions);
		});

		it('It should return the value of the first parameter if the first parameter has a value and the second parameter is empty', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const returned = reconcilePermissions(currentPermissions, null);
			expect(returned).to.deep.equal(currentPermissions);
		});
	});

	context('reconcilePermissions function - value does not change when there is no key match or match is not more restrictive (permission true -> false)', () => {
		it('It should return the value of the first parameter if the second parameter has no category matches', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const requestedPermissions = createPermissionObject(['InterApplicationBus', 'System'], ['publish', 'subscribe', 'clearCache', 'blur'], 'false');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter if the second parameter has category matches but no name matches', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['getChildWindows', 'getManifest', 'close', 'flash'], 'false');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter if the second parameter has category and name matches but the value is always true', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const requestedPermissions = createPermissionObject(['Application'], ['close', 'createApplication'], 'true');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter if the second parameter has category and name matches but first parameter contains only false', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'false');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'true');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter if the second parameter has category and name matches but the value is neither true nor false', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'junk');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter if the second parameter matches are only false when the first parameter is false and true when first parameter is true or false', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'getOptions', 'animate', 'blur', 'close', 'bringToFront'], 'alternate_true');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'alternate_true');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});
	});
	context('reconcilePermissions function - overwrite values that match and are more restrictive (permission true -> false)', () => {
		it('It should return the combination of first and second parameter where second parameter has matches and is more restrictive in all cases', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'getOptions', 'animate', 'blur', 'close', 'bringToFront'], 'true');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'animate', 'blur'], 'false');
			const finalBools = [false, false, true, true, false, false, true, true];
			const expectedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'getOptions', 'animate', 'blur', 'close', 'bringToFront'], 'specify', finalBools);

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(expectedPermissions);
		});

		it('It should return the value of the second parameter when it has all keys and categories identical to the first parameter and every value is more restrictive in the second parameter', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'false');
			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(requestedPermissions);
		});

		it('It should return the combination of first and second parameter with only some values getting overwritten when the second parameter is only more restrictive in some cases', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'alternate_false');
			const requestedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'alternate_true');

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			const expectedPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'false');
			expect(returned).to.deep.equal(expectedPermissions);
		});
	});
	context('reconcilePermissions function - handle options cases', () => {
		it('It should return the value of the first parameter when the second parameter has no options', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			const requestedPermissions = JSON.parse(JSON.stringify(currentPermissions));
			addOptionsToPermission(currentPermissions, 'Window', { preload: true });

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter when the second parameter has had different options', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			addOptionsToPermission(currentPermissions, 'Window', { preload: true });

			const requestedPermissions = JSON.parse(JSON.stringify(currentPermissions));
			addOptionsToPermission(requestedPermissions, 'Window', { notpreload: false });

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the first parameter when both parameters have preload but the first parameter is more restrictive', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			addOptionsToPermission(currentPermissions, 'Window', { preload: false });

			const requestedPermissions = JSON.parse(JSON.stringify(currentPermissions));
			addOptionsToPermission(requestedPermissions, 'Window', { preload: true });

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(currentPermissions);
		});

		it('It should return the value of the second parameter when both parameters have preload and it is more restrictive in the second parameter', () => {
			const currentPermissions = createPermissionObject(['Application', 'Window'], ['close', 'createApplication', 'getChildWindows', 'animate', 'blur', 'close'], 'true');
			addOptionsToPermission(currentPermissions, 'Window', { preload: true });

			const requestedPermissions = JSON.parse(JSON.stringify(currentPermissions));
			addOptionsToPermission(requestedPermissions, 'Window', { preload: false });

			const returned = reconcilePermissions(currentPermissions, requestedPermissions);
			expect(returned).to.deep.equal(requestedPermissions);
		});
	});
	context('checkPermissions function, params: object, permission', () => {
		object = {
			permissions: {
				Window: {
					blur: false,
				}
			}
		};
		it('It should return the value of the permission if the permission exists in the object and the value is not undefined', () => {
			permission = 'Window.blur';
			expect(checkPermission(object, permission)).equal(false);
		});
		it('It should return true if the object does not exist', () => {
			const badObject = {};
			permission = 'Window.blur';
			expect(checkPermission(badObject, permission)).equal(true);
		});
		it('It should return true if the object exists but does not contain any permissions', () => {
			const badObject = { customData: { stuff: 'stuff' } };
			permission = 'Window.blur';
			expect(checkPermission(badObject, permission)).equal(true);
		});
		it('It should return true if the permission does not exist in the object', () => {
			permission = 'Window.close';
			expect(checkPermission(object, permission)).equal(true);
		});
	});
	after((done) => {
		done();
	});
});
