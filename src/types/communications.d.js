/**
 * BusEvent created for events from the MainBus
 * @typedef {Object} BusEvent
 *
 * @property {String} topic name of the event that will be emitted
 * @property {ElectronEvent} rawEvent electron event that originated this bus event
 * @property {FinsembleEvent} rawArgs renderer information used to create this bus event
 * @property {Object} data payload to send with the BusEvent
 * @property {Function} respondSync callback to respond syncronously
 * @property {Function} respond callback to respond asyncronously
 */

/**
 * FinsembleEvent are emitted from MainBus for main process communications
 *
 * @typedef {Object} FinsembleEvent
 *
 * @property {FinsembleEventType} type
 * @property {String} topic names the channel this event will be broadcasted upon
 * @property {String} id unique identifier
 * @property {String} name
 */

/**
 * Possible types for a FinsembleEvent
 *
 * @enum {Object}
 */
const FinsembleEventType = {
	window: 'window',
	application: 'application',
};

/**
* @typedef RequestHelperRequest
* @property {string} topic Topic for this request
* @property {object} data Any data to send to the main process
* @property {boolean} [persistChannel] Whether we should stop listening
* after we receive a response from the main process.
*/

/**
* @typedef RequestHelperEventObject
* @property {string} topic Topic for the request
* @property {object} data Any data to be sent over to the main process
* @property {string} responseUUID The channel that we listen to on the IPC.
* **The main process will respond on this channel.** A user could call `getOptions` 40 times in a loop with different * parameters in each call. This UUID ensures that each call to `getOptions` is returned to the originating call.
* @property {Function} functionCB Method to be invoked after the main process
* responds to the request.
* @property {Function} cb Method with no known purpose.
*/
