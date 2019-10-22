const stringify = require('./safeStringify');
const _get = require('lodash.get');


/**
 * @param obj Object with a property you want to stringify.
 * @param path Path to the property that you want to safely stringify
 * @param replacer replacer....
 * @param spaces number of spaces in the string.
 */
module.exports = (obj, path, replacer = null, spaces = 2) => stringify(_get(obj, path));
