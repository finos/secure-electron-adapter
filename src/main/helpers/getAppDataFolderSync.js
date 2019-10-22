const app = require('electron').app;

module.exports = () => app.getPath('appData');
