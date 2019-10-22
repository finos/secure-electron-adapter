const chromePermissions = require('./chromePermissions');
// rename file
module.exports = {

	// Integer - Window's width in pixels. Default is `800`.
	width: 800,
	windowName: 'null',
	// Integer - Window's height in pixels. Default is `600`.
	height: 600,
	// Integer - Window's left offset from screen. Default is to center the window.
	x: undefined,
	// Integer - Window's top offset from screen. Default is to center the window.
	y: undefined,
	// Boolean - The `width` and `height` would be used as web page's size, which means the actual window's size will include window frame's size and be slightly larger. Default is `false`.
	useContentSize: false,
	// Boolean - Show window in the center of the screen.
	center: undefined,
	// Integer - Window's minimum width. Default is `0`.
	minWidth: 0,
	// Integer - Window's minimum height. Default is `0`.
	minHeight: 0,
	// Integer - Window's maximum width. Default is no limit.
	maxWidth: undefined,
	// Integer - Window's maximum height. Default is no limit.
	maxHeight: undefined,
	// Boolean - Whether window is resizable. Default is `true`.
	resizable: true,
	// Boolean - Whether the window should always stay on top of other windows. Default is `false`.
	alwaysOnTop: false,
	// Boolean - Whether the window should show in fullscreen. When set to `false` the fullscreen button will be hidden or disabled on OS X. Default is `false`.
	fullscreen: false,
	// Boolean - Whether to show the window in taskbar. Default is `false`.
	skipTaskbar: false,
	// Boolean - The kiosk mode. Default is `false`.
	kiosk: false,
	// String - Default window title. Default is `'Electron'`.
	title: 'Electron',
	// [NativeImage](https://github.com/atom/electron/blob/master/docs/api/native-image.md) - The window icon, when omitted on Windows the executable's icon would be used as window icon.
	icon: undefined,
	// Boolean - Whether window should be shown when created. Default is `true`.
	show: true,
	// Boolean - Specify `false` to create a [Frameless Window](https://github.com/atom/electron/blob/master/docs/api/frameless-window.md). Default is `true`.
	frame: false,
	// Boolean - Whether the web view accepts a single mouse-down event that simultaneously activates the window. Default is `false`.
	acceptFirstMouse: false,
	// Boolean - Whether to hide cursor when typing. Default is `false`.
	disableAutoHideCursor: false,
	// Boolean - Auto hide the menu bar unless the `Alt` key is pressed. Default is `false`.
	autoHideMenuBar: false,
	// Boolean - Enable the window to be resized larger than screen. Default is `false`.
	enableLargerThanScreen: false,
	// String - Window's background color as Hexadecimal value, like `#66CD00` or `#FFF`. This is only implemented on Linux and Windows. Default is `#000` (black).
	backgroundColor: '#000',
	// Boolean - Forces using dark theme for the window, only works on some GTK+3 desktop environments. Default is `false`.
	darkTheme: false,
	// Boolean - Makes the window [transparent](https://github.com/atom/electron/blob/master/docs/api/frameless-window.md). Default is `false`.
	transparent: false,
	// String - Specifies the type of the window, which applies additional platform-specific properties. By default it's undefined and you'll get a regular app window. Supported values:
	// * On Linux, possible types are `desktop`, `dock`, `toolbar`, `splash`, `notification`.
	// * On OS X, possible types are `desktop`, `textured`. The `textured` type adds metal gradient appearance (`NSTexturedBackgroundWindowMask`). The `desktop` type places the window at the desktop background window level (`kCGDesktopWindowLevel - 1`). Note that desktop window will not receive focus, keyboard or mouse events, but you can use `globalShortcut` to receive input sparingly.
	type: undefined,
	// String, OS X - specifies the style of window title bar. This option is supported on OS X 10.10 Yosemite and newer. There are three possible values:
	// * `default` or not specified, results in the standard gray opaque Mac title bar.
	// * `hidden` results in a hidden title bar and a full size content window, yet the title bar still has the standard window controls ("traffic lights") in the top left.
	// * `hidden-inset` results in a hidden title bar with an alternative look where the traffic light buttons are slightly more inset from the window edge.
	titleBarStyle: undefined,
	// Object - Settings of web page's features.
	webPreferences: {
		// Boolean - Whether node integration is enabled. Default is `true`.
		nodeIntegration: true,
		// String - Specifies a script that will be loaded before other scripts run in the page. This script will always have access to node APIs no matter whether node integration is turned on or off. The value should be the absolute file path to the script.
		// When node integration is turned off, the preload script can reintroduce Node global symbols back to the global scope. See example [here](https://github.com/atom/electron/blob/master/docs/api/process.md#event-loaded).
		preload: undefined,
		// String - Sets the session used by the page. If `partition` starts with `persist:`, the page will use a persistent session available to all pages in the app with the same `partition`. if there is no `persist:` prefix, the page will use an in-memory session. By assigning the same `partition`, multiple pages can share the same session. If the `partition` is unset then default session of the app will be used.
		partition: undefined,
		// Number - The default zoom factor of the page, `3.0` represents `300%`. Default is `1.0`.
		zoomFactor: 1.0,
		// Boolean - Disable zoom at the application level. Individual windows are still able to zoom in/out by injecting zoom.js preload. This is feature is introduced due to a chromiun [bug](https://github.com/electron/electron/issues/8793)
		disableZoom: true,
		// Boolean - Enables JavaScript support. Default is `true`.
		javascript: true,
		// Boolean - When setting `false`, it will disable the same-origin policy (Usually using testing websites by people), and set `allowDisplayingInsecureContent` and `allowRunningInsecureContent` to `true` if these two options are not set by user. Default is `true`.
		webSecurity: true,
		// Boolean - Allow an https page to display content like images from http URLs. Default is `false`.
		allowDisplayingInsecureContent: false,
		// Boolean - Allow a https page to run JavaScript, CSS or plugins from http URLs. Default is `false`.
		allowRunningInsecureContent: false,
		// Boolean - Enables image support. Default is `true`.
		images: true,
		// Boolean - Enables Java support. Default is `false`.
		java: false,
		// Boolean - Make TextArea elements resizable. Default is `true`.
		textAreasAreResizable: true,
		// Boolean - Enables WebGL support. Default is `true`.
		webgl: true,
		// Boolean - Enables WebAudio support. Default is `true`.
		webaudio: true,
		// Boolean - Whether plugins should be enabled. Default is `false`.
		plugins: false,
		// Boolean - Enables Chromium's experimental features. Default is `false`.
		experimentalFeatures: false,
		// Boolean - Enables Chromium's experimental canvas features. Default is `false`.
		experimentalCanvasFeatures: false,
		// Boolean - Enables overlay scrollbars. Default is `false`.
		overlayScrollbars: false,
		// Boolean - Enables overlay fullscreen video. Default is `false`.
		overlayFullscreenVideo: false,
		// Boolean - Enables Shared Worker support. Default is `false`.
		sharedWorker: false,
		// Boolean - Enables DirectWrite font rendering system on Windows. Default is `true`.
		directWrite: true,
		// Boolean - Page would be forced to be always in visible or hidden state once set, instead of reflecting current window's visibility. Users can set it to `true` to prevent throttling of DOM timers. Default is `false`.
		pageVisibility: false,
	},
	permissions: {
		Application: {
			close: true,
			createApplication: true,
			getChildWindows: true,
			getManifest: true,
			getOptions: true,
			getTrayIconInfo: true,
			remoteApplicationEvents: true,
			removeTrayIcon: true,
			restartApplication: true,
			setTrayIcon: true,
			spawn: true,
			syncAppInfo: true,
			addListener: {
				closed: true,
				connected: true,
				crashed: true,
				initialized: true,
				'manifest-changed': true,
				'not-responding': true,
				'out-of-memory': true,
				responding: true,
				'run-requested': true,
				started: true,
				'tray-icon-clicked': true,
				'window-alert-requested': true,
				'window-auth-requested': true,
				'window-blurred': true,
				'window-bounds-changed': true,
				'window-bounds-changing': true,
				'window-closed': true,
				'window-closing': true,
				'window-crashed': true,
				'window-created': true,
				'window-disabled-frame-bounds-changed': true,
				'window-disabled-frame-bounds-changing': true,
				'window-embedded': true,
				'window-end-load': true,
				'window-external-process-exited': true,
				'window-external-process-started': true,
				'window-file-download-completed': true,
				'window-file-download-progress': true,
				'window-file-download-started': true,
				'window-focused': true,
				'window-frame-disabled': true,
				'window-frame-enabled': true,
				'window-group-changed': true,
				'window-hidden': true,
				'window-initialized': true,
				'window-maximized': true,
				'window-minimized': true,
				'window-navigation-rejected': true,
				'window-not-responding': true,
				'window-out-of-memory': true,
				'window-preload-scripts-state-changed': true,
				'window-preload-scripts-state-changing': true,
				'window-reloaded': true,
				'window-responding': true,
				'window-restored': true,
				'window-show-requested': true,
				'window-shown': true,
				'window-start-load': true
			},
			// createFromManifest: true, // unimplemented
			// getZoomLevel: true, // unimplemented
			// getGroups: true, // unimplemented
			// getInfo: true, // unimplemented
			// getParentUuid: true, // unimplemented
			// getShortcuts: true, // unimplemented
			// isRunning: true, // unimplemented
			// registerUser: true, // unimplemented
			// run: true, // unimplemented
			// scheduleRestart: true, // unimplemented
			// setShortcuts: true, // unimplemented
			// setZoomLevel: true, // unimplemented
			// terminate: true, // unimplemented
		},
		InterApplicationBus: {
			publish: true,
			subscribe: true,
			// addSubscribeListener: true, // unimplemented
			// addUnsubscribeListener: true, // unimplemented
			// removeSubscribeListener: true, // unimplemented
			// removeUnsubscribeListener: true, // unimplemented
			// send: true, // unimplemented
			// unsubscribe: true // implemented, but not sent
		},
		Notification: {
			notification: true,
		},
		System: {
			clearCache: true,
			exit: true,
			flushStorage: true,
			getAllApplications: true,
			getAllWindows: true,
			getHostSpecs: true,
			getMonitorInfo: true,
			getMousePosition: true,
			getProcessList: true,
			getRuntimeInfo: true,
			getVersion: true,
			launchExternalProcess: true,
			readRegistryValue: true, // unimplemented, but in a security policy
			openUrlWithBrowser: true,
			showDeveloperTools: true,
			addListener: {
				'application-closed': true,
				'application-connected': true,
				'application-crashed': true,
				'application-created': true,
				'application-initialized': true,
				'application-manifest-changed': true,
				'application-not-responding': true,
				'application-responding': true,
				'application-run-requested': true,
				'application-started': true,
				'application-tray-icon-clicked': true,
				'desktop-icon-clicked': true,
				'idle-state-changed': true,
				'monitor-info-changed': true,
				'session-changed': true,
				'window-blurred': true,
				'window-bounds-changed': true,
				'window-bounds-changing': true,
				'window-closed': true,
				'window-closing': true,
				'window-crashed': true,
				'window-created': true,
				'window-disabled-frame-bounds-changed': true,
				'window-disabled-frame-bounds-changing': true,
				'window-embedded': true,
				'window-end-load': true,
				'window-external-process-exited': true,
				'window-external-process-started': true,
				'window-file-download-completed': true,
				'window-file-download-progress': true,
				'window-file-download-started': true,
				'window-focused': true,
				'window-frame-disabled': true,
				'window-frame-enabled': true,
				'window-group-changed': true,
				'window-hidden': true,
				'window-initialized': true,
				'window-maximized': true,
				'window-minimized': true,
				'window-navigation-rejected': true,
				'window-not-responding': true,
				'window-preload-scripts-state-changed': true,
				'window-preload-scripts-state-changing': true,
				'window-reloaded': true,
				'window-responding': true,
				'window-restored': true,
				'window-shown': true,
				'window-start-load': true
			}
			// deleteCache: true, // unimplemented
			// downloadAsset: true, // unimplemented
			// downloadPreloadScripts: true, // unimplemented
			// downloadRuntime: true, // unimplemented
			// flushCookie: true, // unimplemented
			// getAllExternalApplication: true, // unimplemented
			// getAppAssetInfo: true, // unimplemented
			// getCommandLineArguments: true, // unimplemented
			// getCookies: true, // unimplemented
			// getCrashReporterState: true, // unimplemented
			// getDeviceUserId: true, // unimplemented
			// getEntityInfo: true, // unimplemented
			// getEnvironmentVariable: true, // unimplemented
			// getFocusedWindow: true, // unimplemented
			// getLogList: true, // unimplemented
			// getMachineId: true, // unimplemented
			// getMinLogLevel: true, // unimplemented
			// getProxySettings: true, // unimplemented
			// log: true, // unimplemented
			// monitorExternalProcess: true, // unimplemented
			// registerExternalConnection: true, // unimplemented
			// releaseExternalProcess: true, // unimplemented
			// setMinLogLevel: true, // unimplemented
			// startCrashReporter: true, // unimplemented
			// terminateExternalProcess: true, // unimplemented
			// updateProxySettings: true, // unimplemented
		},
		Window: {
			animate: true,
			authenticate: true,
			blur: true,
			bringToFront: true,
			close: true,
			closeRequestedAdd: true,
			closeRequestedRemove: true,
			createWindowWithAffinity: true,
			disableFrame: true,
			enableFrame: true,
			executeJavaScript: true,
			flash: true,
			focus: true,
			getAllFrames: true,
			getBounds: true,
			getDetails: true,
			getGroup: true,
			getInfo: true,
			getNativeWindow: true,
			getOptions: true,
			getParentApplication: true,
			getParentWindow: true,
			getState: true,
			getZoomLevel: true,
			hide: true,
			isShowing: true,
			joinGroup: true,
			leaveGroup: true,
			maximize: true,
			minimize: true,
			moveBy: true,
			moveTo: true,
			navigate: true,
			navigateBack: true,
			navigateForward: true,
			reload: true,
			removeListener: true,
			resizeBy: true,
			resizeTo: true,
			restore: true,
			setAsForegroundColor: true,
			setBounds: true,
			setZoomLevel: true,
			syncWindowInfo: true,
			show: true,
			showAt: true,
			showDeveloperTools: true,
			stopFlashing: true,
			stopNavigation: true,
			updateOptions: true,
			addListener: {
				'auth-requested': true,
				'begin-user-bounds-changing': true,
				blurred: true,
				'bounds-changed': true,
				'bounds-change-end': true,
				'close-requested': true,
				closed: true,
				closing: true,
				crashed: true,
				'disabled-frame-bounds-changed': true,
				'disabled-frame-bounds-changing': true,
				embedded: true,
				'end-user-bounds-changing': true,
				'external-process-exited': true,
				'external-process-started': true,
				'file-download-completed': true,
				'file-download-progress': true,
				'file-download-started': true,
				focused: true,
				'frame-disabled': true,
				'frame-enabled': true,
				'group-changed': true,
				hidden: true,
				initialized: true,
				maximized: true,
				minimized: true,
				'navigation-rejected': true,
				'preload-scripts-state-changed': true,
				'preload-scripts-state-changing': true,
				reloaded: true,
				'resource-load-failed': true,
				'resource-response-received': true,
				restored: true,
				'show-requested': true,
				shown: true,
				/* Electron events, these are not emitted by openfin
				'always-on-top-changed': true,
				'app-command': true,
				blur: true,
				close, true,
				closed: true, //also an openfin event
				'enter-full-screen': true,
				'enter-html-full-screen': true,
				focus: true,
				hide: true,
				'leave-full-screen': true,
				'leave-html-full-screen': true,
				maximize: true,
				minimize: true,
				move: true,
				moved: true,
				'new-window-for-tab': true,
				'page-title-updated': true,
				'ready-to-show': true,
				responsive: true,
				restore: true,
				resize: true,
				'scroll-touch-begin': true,
				'scroll-touch-edge': true,
				'scroll-touch-end': true,
				'session-end': true,
				'sheet-begin': true,
				'sheet-end': true,
				show: true,
				swipe: true,
				unmaximize: true,
				unresponsive: true,
				'will-move': true,
				'will-resizeBy': true */
			},
			chromePermissions,
			webPreferences: {
				preload: true
			}
		}
	}
};
