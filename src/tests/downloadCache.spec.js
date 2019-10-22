const chai = require('chai');
const downloadCache = require('../common/downloadCache');
const fs = require('fs');
const path = require('path');

const DEFAULT_CACHE_PATH = require('../main/helpers/getCachePathSync')();

const expect = chai.expect;

const downloadPaths = [];
describe('DownloadOrCache', () => {
	context('Error Handling', () => {
		it('should return an error if file path is missing', (done) => {
			const params = {};
			downloadCache(params, (e, r) => {
				expect(e).to.be.instanceOf(Error);
				expect(r).to.equal(null);
				done();
			});
		});
		it('should return an error if fromPath is missing', (done) => {
			const params = {
				fileName: 'booger.png',
			};
			downloadCache(params, (e, r) => {
				expect(e).to.be.instanceOf(Error);
				expect(r).to.equal(null);
				done();
			});
		});

		it('should return an error if it tries to delete a file that doesn\'t exist', (done) => {
			const params = {
				fileName: 'booger.png',
				invalidateCache: true,
			};
			// By invalidating the cache on a file that we haven't previously downloaded, it will fail.
			downloadCache(params, (e, r) => {
				expect(e).to.be.instanceOf(Error);
				expect(r).to.equal(null);
				done();
			});
		});

		// the download function's error handling doesn't seem to be what I'm expecting.
		// @todo, fix this in the future.
		it.skip('Should return an error if the download fails', (done) => {
			const params = {
				fileName: 'thing.png',
				fromPath: 'httz://wgopgpogpe.boo.com/blahblah.png',
			};
			downloadCache(params, (e, r) => {
				expect(e).to.be.instanceOf(Error);
				downloadPaths.push(r);
				done();
			});
		});
	});

	context('Proper behavior', () => {
		const SPOON_URL = 'https://images-na.ssl-images-amazon.com/images/I/51p8F0K5U5L._SY355_.jpg';
		const SPOON_FILENAME = 'sampleSpoon.png';

		it('should return a file path in the default cache if no cache path is provided', (done) => {
			const params = {
				fileName: SPOON_FILENAME,
				fromPath: SPOON_URL,
			};
			downloadCache(params, (e, r) => {
				expect(e).to.equal(null);
				expect(r.includes(DEFAULT_CACHE_PATH)).to.equal(true);
				downloadPaths.push(r);
				done();
			});
		});

		it('Should make sure that the file in the default cache', () => {
			const filePath = path.join(DEFAULT_CACHE_PATH, SPOON_FILENAME);
			const fileExists = fs.existsSync(filePath);
			expect(fileExists).to.be.true;
		});


		it('should return a file path in the provided cache if a cachePath is provided', (done) => {
			const params = {
				fileName: SPOON_FILENAME,
				fromPath: SPOON_URL,
				cachePath: __dirname,
			};
			downloadCache(params, (e, r) => {
				expect(e).to.equal(null);
				expect(r.includes(__dirname)).to.equal(true);
				downloadPaths.push(r);
				done();
			});
		});

		it('Should retrieve a file from cache if previously downloaded', (done) => {
			// If the file's mtime (modified time) are equal, we can be confident that it was retrieved from the cache.
			const params = {
				fileName: SPOON_FILENAME,
				fromPath: SPOON_URL,
				cachePath: __dirname,
			};
			const filePath = path.join(__dirname, SPOON_FILENAME);
			const initialStats = fs.statSync(filePath);
			downloadCache(params, (e, r) => {
				expect(e).to.equal(null);
				const downloadStats = fs.statSync(r);
				expect(JSON.stringify(initialStats.mtime)).to.equal(JSON.stringify(downloadStats.mtime));
				done();
			});
		});

		it('Should download a new version of the file if invalidateCache is true', (done) => {
			const params = {
				fileName: SPOON_FILENAME,
				fromPath: SPOON_URL,
				cachePath: __dirname,
				invalidateCache: true,
			};
			const filePath = path.join(__dirname, SPOON_FILENAME);
			const initialStats = fs.statSync(filePath);
			downloadCache(params, (e, r) => {
				expect(e).to.equal(null);
				const downloadStats = fs.statSync(r);
				// If the file's mtime (modified time) are not equal, we can be confident that it was retrieved from the url provided.
				expect(JSON.stringify(initialStats.mtime)).to.not.equal(JSON.stringify(downloadStats.mtime));
				done();
			});
		});
	});

	after((done) => {
		// Cleanup any files we created.
		downloadPaths.forEach((filePath) => {
			fs.unlinkSync(filePath);
		});
		done();
	});
});
