const MainBus = require('./MainBusClass')
// For some reason MainBus can't be used inside some files
// Adding it to process allows it to be accessible in all places.
const mainBus = new MainBus();
process.mainBus = mainBus;
module.exports = mainBus;