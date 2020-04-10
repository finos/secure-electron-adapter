const fileTransport = require('./transports/winston-daily-rotate-file');

module.exports = {
	transports: [ fileTransport ],
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
