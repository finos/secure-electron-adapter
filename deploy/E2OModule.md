# E2O Module

The E2O module consists of three attributes: `e2oLauncher`,`packager`,`e2oApplication`.

## e2oLauncher
`e2oLauncher` allows you to launch an application with your local environment without having to create an installer. It creates an e2o application in the background within it's own process. To use this method call `e2o.e2oLauncher(params,cb)`. Currently, params only takes a `manifest`  parameter. `manifest` is your finsemble manifest url.

```
let params = {manifest:"my manifest url here"}
e2o.e2oLauncher(params,cb)
```

## packager
E2o uses `electron-packager`(https://github.com/electron-userland/electron-packager/blob/master/docs/api.md ) `electron-wininstaller`(https://github.com/electron/windows-installer) to package and create an installer. You must first create a package before creating your installer. See `electron-packager` for more details. E2o provides three utility functions under `e2o.packager` on the `E2O` module: `createPackage`,`createInstaller`,`createFullInstaller`.

## e2oApplication
`e2oApplication` is to be used inside of an electron application. This creates the main E2O application and wraps around your electron application. `e2oApplication` takes two parameters: an Electron app and a Finsemble manifest.

```
const { app } = require('electron');
const {e2oApplication} = require("@chartiq/e2o")
app.on('ready', () => {
    getManifest((err, manifest) => {
        e2oApplication(app, manifest);
    });
});
```