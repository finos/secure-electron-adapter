const merge = require("deepmerge");

/**
 * A global singleton for common config values across all SEA code.
 */
class Config {

	constructor() {
		this.manifest = { 'secure-electron-adapter': Config.DefaultSEAConfig };
	}

	/**
   * Sets manifest value to the `_manifest` param.
   * Merges secure-electron-adapter config values with the DefaultSEAConfig values, with values
   * in the `_manifest` param taking precedence.
   * This function should only be called once.
   * @param {*} _manifest a manifest config object
   */
	initManifestWithDefaults(_manifest) {
		this.manifest = _manifest;
		this.manifest['secure-electron-adapter'] =
      merge(Config.DefaultSEAConfig, this.manifest['secure-electron-adapter'] || {});

		return this.manifest;
	}

	getConfig() {
		return this.manifest;
	}

}

Config.DefaultSEAConfig = {
	logger: {transports: {console : { enable : false}}},
};

module.exports = new Config();
