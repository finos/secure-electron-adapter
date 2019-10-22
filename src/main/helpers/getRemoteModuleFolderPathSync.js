const cachePath = require('./getCachePathSync')();
const path = require('path');

module.exports = () => path.join(cachePath, 'remote_modules');
