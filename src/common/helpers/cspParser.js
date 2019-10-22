class CSPParser {
	/**
	 * A little CSP header parser. It converts raw CSP to an object
	 * Makes it easy to check, delete directives and reconvert to text.
	 * @example
	 * // Create a new parser
	 * const csp = new CSPParser("default-src 'self'")
	 * // Check for a directive
	 * csp.has('script-src') // false
	 * // Delete a directive
	 * csp.delete('default-src')
	 * // Get object CSP
	 * csp.getObject() // {"default-src": "'self'"}
	 * // Get CSP string
	 * csp.toString() // default-src 'self'
	 *
	 */
	constructor(cspString = '') {
		if (typeof cspString !== 'string') {
			throw new TypeError('Invalid CSP string passed');
		}
		this.directives = {};
		this.convertToObject(cspString);
	}

	/**
	 * Converts raw CSP to key/value object.
	 * @param {string} cspString
	 * @returns {void}
	 * @private
	 */
	convertToObject(cspString) {
		cspString.split(';').forEach((item) => {
			const tokens = item.trim().split(/\s+/);
			if (tokens[0]) {
				this.directives[tokens[0]] = tokens
					.slice(1, tokens.length).join(' ');
			}
		});
	}

	/**
	 * Checks whether a directive exists or not.
	 * @param {string} key CSP directive
	 * @returns {boolean}
	 */
	has(key) {
		return this.directives.hasOwnProperty(key);
	}

	/**
	 * Deletes a directive. Chainable method
	 * @param {string} key The directive name
	 * @returns {object} this
	 */
	delete(key) {
		delete this.directives[key];
		return this;
	}

	/**
	 * Returns a CSP string. Output example:
	 * script-src 'local'; default-src 'somedomain.com';
	 * @returns {string}
	 */
	toString() {
		let out = '';
		for (const directive in this.directives) {
			if (this.directives[directive]) {
				// ${directive} = key while ${this.directives[directive]} = vallue.
				out += `${directive} ${this.directives[directive]}; `;
			}
		}
		return out.trim();
	}

	/**
	 * Returns an object with directives key:value.
	 * @returns {object}
	 */
	getObject() {
		return this.directives;
	}
}

module.exports = CSPParser;
