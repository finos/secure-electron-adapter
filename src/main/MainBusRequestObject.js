const logger = require('../logger/')();

class MainBusRequestObject {

    /**
     * A main bus request object to be emitted by MainBus.
     * 
	 * @param {Electron Event} event - The electron event
	 * @param {FinsembleEvent} args - Information we need to handle the request
	 * @param {UUID} responseUUID - This tells us what channel to respond on
     */
    constructor(event, args, responseUUID) {
        this.sender = event.sender;
		this.rawEvent = event;
		this.rawArgs = args;
		this.topic = args.topic;
        this.data = args.data;
        this.responseUUID = responseUUID;
    }

    /**
     * "Syncs" the response by setting the event return value to `response`.
     * @param {*} response 
     */
    respondSync(response)
    {
        this.rawEvent.returnValue = response;
    }

    /**
     * Responds to the event with the given `response`.
     * @param {*} response the response to send with the event sender.
     */
    respond(response)
    {
        if (!this.rawEvent.sender) return;
        try {
            this.rawEvent.sender.send(this.responseUUID, response);
        } catch (err) {
            logger.error(`Window is gone, unable to send ${this.rawArgs.topic}`);
        }
    }
}

module.exports = MainBusRequestObject;
