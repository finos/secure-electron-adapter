const RequestHelper = require('./RequestHelper');
const { checkAndLogAccessDenied } = require('../common/helpers');
const logger = require('../logger/')();

class Notification {
	constructor(params) {
		RequestHelper.sendRequest({ topic: 'notification', data: params }, (event, response) => {
			checkAndLogAccessDenied(response);
		});
	}

	// not implemented
	getCurrent() {
		logger.error('Unimplemented method: Notification.getCurrent');
	}

	// not implemented
	close() {
		logger.error('Unimplemented method: Notification.close');
	}

	// not implemented
	sendMessage() {
		logger.error('Unimplemented method: Notification.sendMethod');
	}

	// not implemented
	sendMessageToApplication() {
		logger.error('Unimplemented method: Notification.sendMessageToApplication');
	}
}

module.exports = Notification;
