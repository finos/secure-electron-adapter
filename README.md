[![Codeship Status for ChartIQ/finsemble-electron-adapter](https://app.codeship.com/projects/42683d90-5f02-0137-981c-36e39cc21c1e/status)](https://app.codeship.com/projects/343626)

# Finsemble Electron Adapter

Until further notice, use "develop" branches of finsemble, finsemble-seed, finsemble-electron-adapter.

### Initial Configuration
```
cd finsemble-electron-adapter
npm install
npm link
cd finsemble-seed
npm link @chartiq/finsemble-electron-adapter
```
In finsemble-seed open configs/other/server-environment-startup.json
Add `"container":"electron"`

### Running finsemble-electron-adapter

The finsemble-electron-adapter must be run before starting finsemble. When started, it will remain running in the background watching for changes, but can safely be killed as long as it is run after any code changes.

```
cd finsemble-electron-adapter
npm run dev
```

Whenever there are package.json changes they must be installed before running the finsemble-electron-adapter to pull in the updates to the new packages.

```
cd finsemble-electron-adapter
npm install
npm run dev
```



Use seed project as you normally would. Electron will now be used underneath.

To debug:

- Open Chrome and navigate to `chrome://inspect`
- Click "Open Dedicated Devtools for Node"
- Select "Add connection" under the Connection tab
- Enter `localhost:5858` (the port can be found in the e2o package.json in the startbrk section under the flag --inspect-brk)
- Under the Sources tab, click on the Node subheading to see the sources list.

## Code Organization
- index.js is the file that will run in the deployed Finsemble Application.
- exports.js is a collection of files that you would traditionally assume is exported by a node module.
- src/Main is code that runs inside of Node.
- src/Render is code that runs inside of the browser.
