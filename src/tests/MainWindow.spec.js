const expect = require('chai').expect;
const sinon = require('sinon');
const EventEmitter = require('events');
const MainWindow = require('../main/MainWindow');

describe('MainWindow', () => {
	describe('annotate preload handling', () => {
		describe('Window can preload new scripts', () => {
			it('should permit any file that doesn\'t already exist in the trusted preloads array. Filenames or URLs should work.', () => {
				const FileNames = ['file.js',
					'https://domain.com/secondFile.js',
					'https://secondDomain.com/zebra.js',
					'elephant.txt'];
				const fileList = FileNames.map(url => ({ url }));
				const trustedPreloads = [fileList[1].url, fileList[0].url];
				const preloadsAllowed = true;

				// This is the function we're testing.
				const annotatedPreloads = MainWindow._annotatePreloadList({ fileList, preloadsAllowed, trustedPreloads });


				const permittedPreloads = annotatedPreloads.filter(item => item.isPermitted);
				const newlyTrustedPreloads = annotatedPreloads.filter(item => item.addToTrusted);

				// We have 2 items in our trusted array. One is a filename, and one is a URL.
				// Preloads are allowed, so we're going to permit all 4 files.
				// Additionally, for every URL that is not currently trusted, we should have two entries. One for the URL, and one for the filename.
				// The original 4, plus secondFile.js and zebra.js === 6 files
				expect(permittedPreloads.length).to.equal(6);

				// Of the 6 permitted preloads, 2 were already trusted. We should expect 4 more.
				expect(newlyTrustedPreloads.length).to.equal(4);
			});
		});

		describe('Window cannot preload new scripts', () => {
			it('Should only permit files that are already in the trusted preloads array', () => {
				const FileNames = ['file.js',
					'https://domain.com/secondFile.js',
					'https://secondDomain.com/zebra.js',
					'elephant.txt'];
				const fileList = FileNames.map(url => ({ url }));
				const trustedPreloads = [fileList[0].url, fileList[1].url];
				const preloadsAllowed = false;
				const annotatedPreloads = MainWindow._annotatePreloadList({ fileList, preloadsAllowed, trustedPreloads });
				const permittedPreloads = annotatedPreloads.filter(item => item.isPermitted);
				const newlyTrustedPreloads = annotatedPreloads.filter(item => item.addToTrusted);

				expect(permittedPreloads.length).to.equal(2);
				expect(newlyTrustedPreloads.length).to.equal(0);
			});

			it('should not permit a file if the file is not a requiredPreload', () => {
				const FileNames = ['file.js',
					'https://domain.com/secondFile.js'];
				const fileList = FileNames.map(url => ({ url }));
				const trustedPreloads = [
					'https://secondDomain.com/zebra.js',
					'elephant.txt'];
				const preloadsAllowed = false;
				const annotatedPreloads = MainWindow._annotatePreloadList({ fileList, preloadsAllowed, trustedPreloads });
				const permittedPreloads = annotatedPreloads.filter(item => item.isPermitted);
				const newlyTrustedPreloads = annotatedPreloads.filter(item => item.addToTrusted);

				// Neither of the requested files are trusted or required.
				// We should expect the function to return no permitted or trusted preloads.
				expect(permittedPreloads.length).to.equal(0);
				expect(newlyTrustedPreloads.length).to.equal(0);
			});

			it('should permit a file if the file is a requiredPreload', () => {
				const FileNames = ['FSBL.js',
					'http://somedomain.com/windowTitleBar.js',
					'http://somedomain.com/anUntrustedFile.js'];
				const fileList = FileNames.map(url => ({ url }));
				const trustedPreloads = [
					'https://secondDomain.com/zebra.js',
					'elephant.txt'];
				const preloadsAllowed = false;
				const annotatedPreloads = MainWindow._annotatePreloadList({
					fileList, preloadsAllowed, trustedPreloads, finsembleDomain: 'somedomain.com'
				});
				const permittedPreloads = annotatedPreloads.filter(item => item.isPermitted);
				const newlyTrustedPreloads = annotatedPreloads.filter(item => item.addToTrusted);

				// Only FSBL and windowTitleBar should be permitted, because they're 'required preloads' as far as the system is concerned.
				expect(permittedPreloads.length).to.equal(2);
				// Because this component is untrusted (preloadsAllowed === false), we don't
				// want to add its permitted files to the trusted preload array.
				expect(newlyTrustedPreloads.length).to.equal(0);
			});


			it('should not break with an invalid URL', () => {
				const FileNames = ['https://secondDomain\$#$Q#$@\com/zebra.js'];
				const fileList = FileNames.map(url => ({ url }));
				const trustedPreloads = [];
				const preloadsAllowed = true;
				const annotatedPreloads = MainWindow._annotatePreloadList({
					fileList, preloadsAllowed, trustedPreloads, finsembleDomain: 'somedomain.com'
				});
				const permittedPreloads = annotatedPreloads.filter(item => item.isPermitted);
				const newlyTrustedPreloads = annotatedPreloads.filter(item => item.addToTrusted);

				// Both zebra.js, and the broken URL should be permitted.
				expect(permittedPreloads.length).to.equal(2);

				// both permitted preloads should be trusted
				expect(newlyTrustedPreloads.length).to.equal(2);
			});
		});
	});
});
