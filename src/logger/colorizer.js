const colors = {
	FgGrey: "\x1b[90m",
	FgRed: "\x1b[31m",
	FgGreen: "\x1b[32m",
	FgYellow: "\x1b[33m",
	FgBlue: "\x1b[34m",
	FgMagenta: "\x1b[35m",
	FgCyan: "\x1b[36m",
	FgWhite: "\x1b[37m"
}
const levelColors = {
	error: colors.FgRed,
	warn: colors.FgYellow,
	info: colors.FgGrey,
	debug: colors.FgCyan,
	'log-': colors.FgWhite
}
module.exports = (level, text) => {
	return `${levelColors[level]}${text}\x1b[0m`
}