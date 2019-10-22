const argv = process.argv;

module.exports = (flag) => {
	const position = argv.indexOf(flag);
	if (position === -1) {
		return '';
	}
	return argv[position + 1];
};
