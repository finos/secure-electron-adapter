const { transports, format } = require('winston');
const colorizer = require('../colorizer');

module.exports = new transports.Console({
	format: format.combine(
		format.timestamp(),
		format.printf((info) => {
			return colorizer(info.level, `[${info.timestamp}] [${info.level}]: ${info.message}`);
		}),
	),
});
