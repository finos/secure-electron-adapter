const stringify = require('fast-safe-stringify');
// If JSON.stringify fails, we'll use the safer, but slightly slower option above.
module.exports = (obj, replacer = null, spaces = 2) => {
	if (obj === null || typeof obj === 'undefined') return '';
	try {
		return JSON.stringify(obj, replacer, spaces);
	} catch (e) {
		return stringify(obj, replacer, spaces);
	}
};
