const path = require('path');
const appData = require('./getAppDataFolderSync')();

module.exports = () => path.join(appData, '/e2o/cache');
