const app = require('electron').app;
const path = require('path');
const appDataFolder = {
	set appDataFolderName(name) {
		this.folderName = name;
	},
	get folderPath() {
		return path.join(app.getPath('appData'), this.folderName);
	},
	folderName: 'Electron',
}
module.exports = appDataFolder;