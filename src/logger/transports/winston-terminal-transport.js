const winston = require('winston');
const formatter = require('../formatters/basic');

const options = {
	formatter,
	level: 'log-'
};
module.exports = new (winston.transports.Console)(options);
