const transports = require('./transports');

module.exports = {
	transports,
	level: 'debug',
	levels: {
		error: 0,
		warn: 1,
		info: 2,
		'log-': 3,
		debug: 4,
		verbose: 5
	}
};
