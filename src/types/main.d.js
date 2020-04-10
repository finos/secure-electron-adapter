/**
 * MainWindow represents a main process window
 *
 * @typedef {Object} MainWindow
 *
 * @property {BrowserWindow} win handle on the BrowserWindow for this MainWindow
 * @property {MainWindowParams} originalParams the params used in MainWindow constructor
 * @property {BrowserWindowParams} details Params passed into new BrowserWindow
 * @property {Object} customData any custom information for this window
 * @property {String} id comes from this.win.id
 * @property {String} appUUID unique identifier for the parent application
 * @property {String} uuid unique identifier for the window
 * @property {String} windowName name of the window
 * @property {boolean} movable window cannot be moved if false
 * @property {boolean} isMoving true if the window is currently moving
 * @property {boolean} closeRequested prevents the close event from immediately occurring
 *
 */

/**
 * MainWindowParams represents params for a main application
 *
 * @typedef {Object} MainWindowParams
 *
 * @property {String} appUUID unique identifier for the parent application
 * @property {String} url url for this window to load
 * @property {String} name name of the window
 * @property {String} affinity render processes with the same affinity use the same process
 * @property {Object} mainWindowOptions
 * @property {Object} mainWindowOptions.customData
 * @property {String[]} preload list of preloads to load into render process
 * @property {boolean} frame hides the window frame if true
 * @property {boolean} visible if false, the window will default to hidden
 * @property {boolean} showTaskbarIcon if true the window will receive a taskbar icon
 * @property {Number} defaultWidth default width of the window
 * @property {Number} defaultHeight default height of the window
 * @property {Number} defaultLeft default left position of the window
 * @property {Number} defaultTop default top position of the window
 */

/**
* MainWindowProcess represents a main process application in sea
*
* @typedef {Object} MainWindowProcess
* @property {MainWindow[]} windows List of windows for this application
* @property {MainWindow} appWindow the window for the application itself
* @property {MainWindowProcessParams} details the parameters used to create the application
* @property {String} state current application state
*/

/**
 * MainWindowProcessParams represents params for a main application
 *
 * @typedef {MainWindowParams} MainWindowProcessParams
 *
 */

