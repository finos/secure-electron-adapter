const localLogger = require('../logger/')();


/**
 * Checks if the accessDenied callback or error text responded to an event
 * If so, log an error
 * Returns true or false in case the calling function needs to do more gating
 * Currently this function is only used to check permission results.
 * @param {*} response
 */
const checkAndLogAccessDenied = (response) => {
	if (typeof response === 'object' && response && response.error) {
		console.log('Warning:', response.message);
		localLogger.warn('Warning:', response.message);
		return true;
	} if (typeof response === 'string' && response.includes('api_access_denied')) {
		console.log('Warning:', response);
		localLogger.warn('Warning:', response);
		return true;
	}
	return false;
};

/**
 * Function that returns an accessDenied error callback or string including the passed in method name
 * @param {object} methodName
 * @param {*} cb
 */
const accessDenied = (methodName, cb = null) => {
	const errorText = `api_access_denied: Access to API method ${methodName} denied.`;
	if (cb && typeof cb === 'function') {
		return cb({ error: 'api_access_denied', message: errorText });
	}
	return errorText;
};

module.exports = {
	checkAndLogAccessDenied,
	accessDenied
}