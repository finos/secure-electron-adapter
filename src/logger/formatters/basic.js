// https://github.com/winstonjs/winston#creating-custom-formats
const {
	combine,
	timestamp,
	printf
} = require('winston').format;

// eslint-disable-next-line arrow-body-style
const formatter = printf((info) => {
	return `[${info.timestamp}] [${info.level}]: ${info.message}`;
});

module.exports = combine(
	timestamp(),
	formatter
);
