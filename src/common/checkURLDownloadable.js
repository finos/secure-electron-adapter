
const { net } = require('electron');
const { isValidURL } = require('./helpers');


/**
 * Verify a url is valid and downloadable by trying to get it with a HTTP request.
 * @param {object} url the url to verify
 * @param {number=} timeout optional timeout in milliseconds; used for regression testing with smaller timeout value
 * @returns Promise
 */
const checkURLDownloadable = (url, timeout) => {
	return new Promise(async (resolve, reject) => {
		const TIMEOUT_WAITING_ON_NET_RESPONSE = timeout || 5000;

		if (!isValidURL(url)) {
			reject(`Illegal URL: ${url} is illegally formatted.`);
		} else {
			// the net.request doesn't catch all errors (see more below) so also need a timer for when no response.
			let netTimer = setTimeout(() => {
				reject(`Confirm Internet connectivity. Timeout trying to verify URL is reachable: ${ url }. If Internet is up, confirm URL is correct.`);
			}, TIMEOUT_WAITING_ON_NET_RESPONSE);

			// net.request will throw an error in some cases (e.g. unsupported protocol used in URL)
			try {
				// make a net.request (i.e. HTTP request) to verify URL.
				// note: net.request misses catching at least three types of error (above timeout catches what's missed here):
				//			1) if internet is down;
				//			2) url port is bad;
				// 			3) bad hostname
				// Although for a missing file on good hostname HTTP 404 is returned and caught below

				const request = net.request(url, (response) => {
					clearTimeout(netTimer);

					// if net error and request never issued
					response.on('error', (error) => {
						reject(`Electron.Net failure trying to verify url is reachable: ${url}. Error: ${error}`);
					});

					// check http statusCode for errors
					if (response.statusCode >= 400) {
						reject(`HTTP Failure trying to verify URL is reachable. URL ${url}. HTTP Status Code = ${response.statusCode}`);
					} else {
						resolve();
					}
				});
				// have to indicate the net.request above is "ended", or request can't finish correctly
				request.end();
			} catch (error) {
				clearTimeout(netTimer);
				reject(`Electron.Net error caught trying to verify url: ${url}. Error: ${error}`);
			}
		}
	});
}

module.exports = checkURLDownloadable;