const path = require('path');
const appData = require('./getAppDataFolderSync').folderPath;

module.exports = () => path.join(appData, '/e2o/cache');
