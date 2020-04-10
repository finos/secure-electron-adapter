const { net } = require('electron');
const Stream = require('stream').Transform;

/**
 * retrieve a stream of data from a URL and return a string
 * @param {String} url to download file from
 * @param {Object} options https://electronjs.org/docs/api/client-request
 *                         https://nodejs.org/api/http.html#http_http_request_options_callback
 * @param {Object} options.headers - all keys in this object are used as headers, the value is used as the header value
 * @param {Boolean} options.returnStream if true, return the full download stream
 *
 * @return {Promise} resolves to a string of data from the URL
 */
const download = (url, options) => new Promise((resolve, reject) => {
	const opts = options || {};
	opts.url = url;
	const request = net.request(opts, (response) => {
		const data = new Stream();
		response.on('data', (chunk) => {
			data.push(chunk);
		});

		// TO DO: response.on('error') will not catch http errors, so should also reject if statusCode >= 400.
		// However, checking statusCode doesn't cover all the cases either (e.g. internet down) so should also set a timer to handle no response.
		// Similar code with these extra checks is in checkURLDownloadable in main.js.
		response.on('error', (error) => {
			reject(error);
		});

		response.on('end', () => {
			if (opts.returnStream) {
				return resolve(data);
			}
			resolve(data.read());
		});
	});
	const headers = opts.headers;
	if (headers) {
		const keys = Object.keys(headers);
		keys.forEach(key => request.setHeader(key, headers[key]));
	}
	request.end();
});

module.exports = download;
