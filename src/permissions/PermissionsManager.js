/**
 * Class to handle permissions checking for all components
 */
const defaultWindowOptions = require('./defaultWindowOptions');
const { accessDenied, isBoolean } = require('../common/helpers');
const _get = require('lodash.get');
const logger = require('../logger/')();

class PermissionsManager {
	constructor() {
		this.addRestrictedListener = this.addRestrictedListener.bind(this);
		this.setDefaultPermissions = this.setDefaultPermissions.bind(this);
		this.reconcilePermissions = this.reconcilePermissions.bind(this);
	}

	/**
	 * Combine the current permissions set with a set of requested permissions
	 * Requested permissions can be a subset of the current permissions, but current permissions must always contain the entire set of allowed permissions for the system.
	 *
	 * The final permissions set will be based on the following rules:
	 * - If the currentPermissions (super set) is missing, the current permissions will be set to a default set of permissions before trying to combine.
	 * - Any requestedPermissions will only replace a value in the currentPermissions list if all of the below are true:
	 * 	-- The requested permission is an exact category and name match of a current permission
	 *  -- The requested permission is false when the current permission is true (because permissions are only changed to be more restrictive than their parent)
	 * @param {Object} currentPermissions //must include all possible permissions
	 * @param {Object} requestedPermissions //may be a subset of all possible permissions
	 */
	reconcilePermissions(currentPermissions, requestedPermissions) {
		// We've chosen not to do any logging around reconcile permissions because it's too large even for verbose
		if (!currentPermissions) {
			logger.warn('Initial list of permissions missing, setting to default list');
			currentPermissions = this.systemPermissions || defaultWindowOptions.permissions;
		}
		const finalPermissions = JSON.parse(JSON.stringify(currentPermissions));
		if (requestedPermissions) {
			// Iterate over requestedPermissions to check if any match a permission in the currentPermission super set
			// If so, set the final permission to the more restrictive of the two.
			for (const category of Object.keys(requestedPermissions)) {
				for (const name of Object.keys(requestedPermissions[category])) {
					if (category in currentPermissions && name in currentPermissions[category]) {
						// Only change permissions if the requested component permissions are more restrictive
						// This will only happen if the current permission is true and the requested permission is false
						if (isBoolean(requestedPermissions[category][name]) && currentPermissions[category][name] - requestedPermissions[category][name] === 1) {
							finalPermissions[category][name] = requestedPermissions[category][name];
						}
						// If the inner item is an object instead of a boolean iterate over it and do the same replacement as above
						if (typeof requestedPermissions[category][name] === 'object' && requestedPermissions[category][name] !== null) {
							// rename for readablity, may need better index names...
							const requestedInnerCategory = requestedPermissions[category][name];
							const currentInnerCategory = currentPermissions[category][name];
							const finalInnerCategory = finalPermissions[category][name];

							for (const name of Object.keys(requestedInnerCategory)) {
								if (name in currentInnerCategory && isBoolean(requestedInnerCategory[name]) && currentInnerCategory[name] - requestedInnerCategory[name] === 1) {
									finalInnerCategory[name] = requestedInnerCategory[name];
								}
							}
						}
					}
				}
			}
		}
		return finalPermissions;
	}

	/**
	 * Set Default Permissions on the PermissionsManager to be used by all components.
	 * Initial default permissions exist in defaultWindowOptions.js. This list is all possible permissions, while other permissions sets may be a subset.
	 * All uses of permissions assume the list is complete so reading in defaultWindowOptions.js is important
	 *
	 * If manifest permissions exist then Default permissions are a combination of these permissions and the initial default permissions.
	 * Otherwise they will be only the default permissions
	 * @param {Object} manifestPermissions
	 */
	setDefaultPermissions(manifestPermissions) {
		this.systemPermissions = this.reconcilePermissions(defaultWindowOptions.permissions, manifestPermissions);
	}

	/**
	 * Checks passed in permission to see if it's allowed
	 * If so, return true. If not allowed, return false.
	 *  * Refer to defaultWindowOptions.js for a list of available permissions
	 *
	 * This function will pass a permission check unless it's explicity false.
	 * This is because we don't want the application to break if a permission is missing from the main list, or if an object has been removed (such as on shutdown)
	 * In the case of a missing permission, log it so it can be added to defaultWindowOptions.js later.
	 * We do the same if the object to look in is empty or missing a permissions section. This can happen on shutdown as windows close, but may also be an error.
	 * @param {Object} obj
	 * @param {string} permission (format: Category.permission, e.g System.clearCache)
	 */
	checkPermission(obj, permission) {
		let result;
		if (obj && obj.permissions) {
			// lodash.get approved for permission checks for dynamic paths
			result = _get(obj.permissions, permission);
		} else {
			logger.debug(`PermissionsManager->checkPermission Object does not exist or does not have a permissions attribute. Object: ${obj} permission: ${permission}`);
			return true;
		}
		if (result === undefined) {
			logger.info(`PermissionsManager->checkPermission Permission is not defined in default permission list ${permission}`);
			return true;
		}
		return result;
	}

	/**
	 * Wrap EventEmitters addListener so we can prevent listeners from being created if not permitted for each function
	 * If adding the listener is permitted or no permission is requested continue to EventEmitter's addListener, otherwise send an accessDenied error
	 * @param {string} eventName
	 * @param {function} handler
	 * @param {string} permission
	 * @returns {function} modifiedHandler
	 */
	async addRestrictedListener(eventName, handler, permission = null) {
		const modifiedHandler = async (e) => {
			if (permission) {
				const name = e.sender.browserWindowOptions.name;
				const mainWin = await process.mainWindowProcessManager.findWindowByName(name);
				if (this.checkPermission(mainWin, permission)) {
					logger.verbose(`PermissionsManager->addRestrictedListener Permission allowed: ${permission}`);
					handler(e);
				} else {
					// Permission denied is already logged at the calling level, logging here only for debugging
					logger.debug(`PermissionsManager->addRestrictedListener Permission denied: ${permission}`);
					accessDenied(permission, e.respond);
				}
			} else {
				handler(e);
			}
		};
		process.mainBus.addListener(eventName, modifiedHandler);
		return modifiedHandler;
	}
}

const singleton = new PermissionsManager();
module.exports = singleton;
