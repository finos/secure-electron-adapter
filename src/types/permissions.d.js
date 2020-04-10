/**
* Global sea permissions
*
* @typedef {Object} seaPermissions
*
* @property {ChromiumPermission[]} chromiumPermissions list of Chromium requiring user approval
* @property {WebPreferencesPermissions} webPreferencesPermissions allow / disallow configuration of webPreference settings
* @property {boolean} navigation enable / disable navigation
*/

/**
* sea permissions for web preferences
*
* @typedef {Object} WebPreferencesPermissions
*
* @property {boolean} sandbox enable / disable chromium sandbox
* @property {boolean} contextIsolation enable / disable context isolation
* @property {boolean} webSecurity enable / disable webSecurity
*/

/**
 * enumeration of Chromium Permissions
 * https://developer.chrome.com/extensions/permissions
 *
 * @enum {Object}
 */
const ChromiumPermission = {
	notification: 'notification',
	debugger: 'debugger',
	declarativeNetRequest: 'declarativeNetRequest',
	devtools: 'devtools',
	geolocation: 'geolocation',
	mdns: 'mdns',
	proxy: 'proxy',
	tts: 'tts',
	ttsEngine: 'ttsEngine',
	wallpaper: 'wallpaper',
};
