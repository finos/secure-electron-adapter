
const electronScreen = require('electron').screen;
const ApplicationManager = require('./ApplicationManager');

function buildUnscaledDisplays() {
	const displays = electronScreen.getAllDisplays();
	let primaryDisplay = electronScreen.getPrimaryDisplay();

	// compute right and bottom
	for (let i = 0; i < displays.length; i++) {
		const display = displays[i];
		display.bounds.right = display.bounds.x + display.bounds.width;
		display.bounds.bottom = display.bounds.y + display.bounds.height;
		if (display.id == primaryDisplay.id) primaryDisplay = display;
	}

	// TODO: this logic seems completely flawed.
	// displays don't have .right or .x properties
	// changing from assignment to condition evaluates to true
	// which exposes a bug when traversing displays .nextX two blocks down
	// get positioning
	// for (let i = 0; i < displays.length; i++) {
	// 	const thisDisplay = displays[i];
	// 	//console.log("thisDisplay", thisDisplay)
	// 	for (let j = 0; j < displays.length; j++) {
	// 		const anotherDisplay = displays[j];
	// 		if (thisDisplay.right = anotherDisplay.x) {
	// 			thisDisplay.nextX = anotherDisplay;
	// 			anotherDisplay.previousX = thisDisplay;
	// 		}
	// 		if (thisDisplay.bottom = anotherDisplay.y) {
	// 			thisDisplay.nextY = anotherDisplay;
	// 			anotherDisplay.previousY = thisDisplay;
	// 		}
	// 	}
	// }

	if (primaryDisplay.scaleFactor != 1) { // assume primary is always at 0,0
		primaryDisplay.unscaledBounds = {
			x: primaryDisplay.bounds.x,
			y: primaryDisplay.bounds.y,
			height: primaryDisplay.bounds.height * primaryDisplay.scaleFactor,
			width: primaryDisplay.bounds.width * primaryDisplay.scaleFactor,
		};
		primaryDisplay.unscaledBounds.right = primaryDisplay.unscaledBounds.x + primaryDisplay.unscaledBounds.width;
		primaryDisplay.unscaledBounds.bottom = primaryDisplay.unscaledBounds.y + primaryDisplay.unscaledBounds.height;
	}

	// get unscaled positioning X
	let thisDisplay = primaryDisplay;
	while (thisDisplay.nextX) {
		const previousDisplay = thisDisplay;
		thisDisplay = thisDisplay.nextX;
		thisDisplay.unscaledBounds = {
			x: previousDisplay.unscaledBounds.right,
			width: thisDisplay.bounds.width * thisDisplay.scaleFactor,
		};
		thisDisplay.unscaledBounds.right = thisDisplay.unscaledBounds.x + thisDisplay.unscaledBounds.width;
	}

	thisDisplay = primaryDisplay;
	while (thisDisplay.previousX) {
		const previousDisplay = thisDisplay;
		thisDisplay = thisDisplay.previousX;
		thisDisplay.unscaledBounds = {
			right: previousDisplay.unscaledBounds.x,
			width: thisDisplay.bounds.width * thisDisplay.scaleFactor,
		};
		thisDisplay.unscaledBounds.x = thisDisplay.unscaledBounds.right - thisDisplay.unscaledBounds.width;
	}

	// get unscaled positioning Y
	thisDisplay = primaryDisplay;
	while (thisDisplay.nextY) {
		const previousDisplay = thisDisplay;
		thisDisplay = thisDisplay.nextY;
		thisDisplay.unscaledBounds.y = previousDisplay.unscaledBounds.top;
		thisDisplay.unscaledBounds.height = thisDisplay.bounds.height * thisDisplay.scaleFactor;
		thisDisplay.unscaledBounds.bottom = thisDisplay.unscaledBounds.y + thisDisplay.unscaledBounds.height;
	}

	thisDisplay = primaryDisplay;
	while (thisDisplay.previousY) {
		const previousDisplay = thisDisplay;
		thisDisplay = thisDisplay.previousY;
		thisDisplay.unscaledBounds.bottom = previousDisplay.unscaledBounds.y;
		thisDisplay.unscaledBounds.height = thisDisplay.bounds.height * thisDisplay.scaleFactor;
		thisDisplay.unscaledBounds.y = thisDisplay.unscaledBounds.bottom - thisDisplay.unscaledBounds.height;
	}

	return displays;
}

module.exports = {
	getMonitorInfo(cb) {
		const displays = buildUnscaledDisplays();
		const pDisplay = electronScreen.getPrimaryDisplay();
		const mi = {
			primaryMonitor: {},
			nonPrimaryMonitors: [],
			virtualScreen: {
				width: pDisplay.bounds.width,
				height: pDisplay.bounds.height,
				bottom: 0,
				top: 0,
				right: 0,
				left: 0,
			},
		};
		let count = 0;

		displays.map((display) => {
			// console.log("electronScreen",display.workArea)
			// let availableScaledRect = electronScreen.dipToScreenRect(window.window,display.workArea);
			// console.log("availableScaledRect",availableScaledRect)
			const monitor = {
				monitor: {
					dipRect: {
						width: display.workAreaSize.width,
						height: display.workAreaSize.height,
						bottom: display.workArea.height + display.workArea.y, // bottom-most monitor coordinate
						left: display.workArea.x, // left-most monitor coordinate
						right: display.workArea.x + display.workArea.width, // right-most monitor coordinate
						top: display.workArea.y, // top-most monitor coordinate
					},
					scaledRect: {
						width: display.workAreaSize.width,
						height: display.workAreaSize.height,
						bottom: display.workArea.height + display.workArea.y, // bottom-most monitor coordinate
						left: display.workArea.x, // left-most monitor coordinate
						right: display.workArea.x + display.workArea.width, // right-most monitor coordinate
						top: display.workArea.y, // top-most monitor coordinate
					},
				},
				deviceScaleFactor: display.scaleFactor,
				availableRect: {
					width: display.workAreaSize.width,
					height: display.workAreaSize.height,
					bottom: display.workArea.height + display.workArea.y, // bottom-most monitor coordinate
					left: display.workArea.x, // left-most monitor coordinate
					right: display.workArea.x + display.workArea.width, // right-most monitor coordinate
					top: display.workArea.y,
				},
				name: `device${count++}`,
				deviceId: display.id.toString(), // device id of the display,
				displayDeviceActive: true, // true if the display is active
				monitorRect: {
					width: display.size.width,
					height: display.size.height,
					bottom: display.bounds.height + display.bounds.y, // bottom-most monitor coordinate
					left: display.bounds.x, // left-most monitor coordinate
					right: display.bounds.x + display.bounds.width, // right-most monitor coordinate
					top: display.bounds.y, // top-most monitor coordinate
				},
			};

			// taskbar location
			let taskbar;
			if (monitor.monitorRect.bottom != monitor.availableRect.bottom) {
				taskbar = {
					top: monitor.availableRect.bottom,
					left: monitor.availableRect.left,
					right: monitor.availableRect.right,
					bottom: monitor.monitorRect.bottom,
					width: monitor.availableRect.width,
					height: monitor.monitorRect.bottom - monitor.availableRect.bottom,
					edge: 'bottom',
				};
			} else if (monitor.monitorRect.top != monitor.availableRect.top) {
				taskbar = {
					top: monitor.monitorRect.top,
					left: monitor.availableRect.left,
					right: monitor.availableRect.right,
					bottom: monitor.availableRect.top,
					width: monitor.availableRect.width,
					height: monitor.monitorRect.top - monitor.availableRect.top,
					edge: 'top',
				};
			} else if (monitor.monitorRect.right != monitor.availableRect.right) {
				taskbar = {
					top: monitor.monitorRect.top,
					left: monitor.availableRect.right,
					right: monitor.monitorRect.right,
					bottom: monitor.availableRect.bottom,
					width: monitor.monitorRect.width - monitor.availableRect.width,
					height: monitor.monitorRect.height,
					edge: 'right',
				};
			} else if (monitor.monitorRect.left != monitor.availableRect.left) {
				taskbar = {
					top: monitor.monitorRect.top,
					left: monitor.monitorRect.left,
					right: monitor.availableRect.left,
					bottom: monitor.availableRect.bottom,
					width: monitor.monitorRect.width - monitor.availableRect.width,
					height: monitor.monitorRect.height,
					edge: 'left',
				};
			}
			monitor.taskbar = taskbar;

			if (pDisplay.id === display.id) {
				mi.primaryMonitor = monitor;
				return;
			}
			mi.nonPrimaryMonitors.push(monitor);
		});
		return cb(mi);
	},
};
