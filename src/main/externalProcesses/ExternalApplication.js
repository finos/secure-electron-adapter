const EventEmitter = require('events').EventEmitter;
const { spawn } = require('child_process');
const logger = require('../../logger/')();

/**
 * This handles any interaction with an external application
 */
module.exports = class ExternalApplication extends EventEmitter {
	constructor(params, cb = Function.prototype) {
		super();
		this.path = params.path;
		this.appReference = null;
		this._spawnFile(params, cb);
	}

	/**
	 * Spawn an application
	 * @param {ExternalApplicationParams} params
	 * @param {Function} cb
	 */
	_spawnFile(params, cb = Function.prototype) {
		if (!params) return;

		logger.log(`Spawning external application: ${params.path}`);
		try {
			this.appReference = spawn(params.path, params.arguments, params.options);
		} catch (e) {
			logger.warn(`Failed to spawn child process ${params.path} ${e.message}`);
			return cb('Error spawning child process');
		}
		this.appReference.stdout.on('data', function (data) {
			this.emit('message', data);
		});

		this.appReference.stderr.on('data', function (data) {
			this.emit('error', data);
		});

		this.appReference.on('close', (code) => {
			logger.log(`Child process exited with code ${code}`);
		});
		return cb();
	}

	/**
	 * Close down an application.
	 */
	close() {
		logger.log(`Closing external application ${this.path}`);
		/**
		 * FEA does not wait for positive confirmation of application closes, as such it is theoretically possible for applications to remain running if they handle signal interrupts and do not gracefully close.
		 */
		if (this.appReference && this.appReference.connected) this.appReference.kill('SIGHUP');
	}
};
