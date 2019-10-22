/**
 * A place to store constructable strings. Can be used to generate errors, warnings, messages,
 * or any other string output that utilizes a context.
 */
const DEFAULT_ERROR = 'Something went wrong.';
const messages = {
	PRELOADS_TYPE_ERROR: context => `Unable to preload window. Preload should be of type [Array] and is instead of type ${context.type}.`,
	DEFAULT_ERROR,
};

module.exports = (key, context) => {
	const message = messages[key];
	if (typeof message === 'undefined') {
		return DEFAULT_ERROR;
	}
	if (typeof message === 'function') {
		try {
			return message(context);
		} catch (err) {
			return DEFAULT_ERROR;
		}
	}
	return message;
};
