const path = require('path');
const appData = require('./getAppDataFolderSync').folderPath;

module.exports = () => path.join(appData, '/sea/cache');
