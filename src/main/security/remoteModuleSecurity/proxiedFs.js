const fs = require('fs');

module.exports = {
	readFileSync: fs.readFileSync,
	existsSync: fs.existsSync,
	readdirSync: fs.readdirSync,
	lstatSync: fs.lstatSync,
	unlinkSync: fs.unlinkSync,
	rmdirSync: fs.rmdirSync,
};
