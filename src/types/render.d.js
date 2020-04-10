/**
 * WindowProcess represents a render process application preload in sea
 *
 * @typedef {Object} WindowProcess
 *
 * @property {String} name name of application
 * @property {String} uuid unique identifier of application
 * @property {boolean} ready if the application is fully initialized, ready is true
 * @property {Object} window object containing information about the application window
 * @property {String} window.name application window's title
 */

/**
 * MessageBus
 *
 * @typedef {Object} MessageBus
 */

/**
 * RenderSystem
 *
 * @typedef {Object} RenderSystem
 */

/**
 * RenderSystemParams
 *
 * @typedef {Object} RenderSystemParams
 */

/**
 * WindowProcess
 *
 * @typedef {Object} WindowProcess
 *
 * @property {String} appUUID unique identifier for parent WindowProcess
 * @property {String} name name of window
 * @property {String} uuid unique idenifier for window
 * @property {Object[]} responses it doesn' look like this is used
 * @property {*} closeRequestedListeners listeners to the close requested event
 * @property {*} sendRequest allows you to send messages to main bus
 */

/**
 * WindowEvent
 *
 * @typedef {Object} WindowEvent
 */

/**
 * WindowBounds
 *
 * @typedef {Object} WindowBounds
 *
 * @property {Number} x
 * @property {Number} y
 * @property {Number} height
 * @property {Number} width
 * @property {Number} right
 * @property {Number} bottom
 */
