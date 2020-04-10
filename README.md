# Secure Electron Adapter

ChartIQ's Secure Electron Adapter provides an easy way to create an Electron application that adheres to Electron's own security recommendations by design.

### Initial Configuration

See SEA-quick-start for example usage

### To debug:

- Open Chrome and navigate to `chrome://inspect`
- Click "Open Dedicated Devtools for Node"
- Select "Add connection" under the Connection tab
- Enter `localhost:5858` (the port can be found in the sea package.json in the startbrk section under the flag --inspect-brk)
- Under the Sources tab, click on the Node subheading to see the sources list.

## Code Organization
- index.js is the file that will run in the deployed Electron application.
- exports.js is a collection of files that you would traditionally assume is exported by a node module.
- src/Main is code that runs inside of Main process of Electron.
- src/Render is code that runs inside of the browser.
