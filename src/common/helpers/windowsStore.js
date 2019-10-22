/**
 * Keeps references to spawned windows params
 */
const windows = {};
module.exports = {
	/**
	 * Adds a window's params
	 * @param {String} name The name of the window
	 * @param {Object} params Params object
	 */
	setParams(name, params) {
		windows[name] = params;
	},
	/**
	 * Returns a window's params
	 * @param {String} name The window name
	 */
	getParams(name) {
		return windows[name];
	},
	/**
	 * Returns an Array of all windows params
	 */
	getAll() {
		return Object.values(windows);
	},
	/**
	 * Deletes a window
	 * @param {String} name The window's name
	 */
	delete(name) {
		delete windows[name];
	}
};
