const chai = require('chai');
const download = require('../common/download');
const { setCookie, getCookieHeader } = require('../common/helpers');
const sinon = require('sinon');
const { net } = require('electron');
const { EventEmitter } = require('events');
const { session } = require('electron');

const expect = chai.expect;

const CommonConfig = require('../common/helpers/Config.js');

describe('download', () => {
	let requestStub;
	beforeEach(async () => {
		// clear session data so no side effects from other tests;
		await session.defaultSession.clearStorageData({});
		await setCookie(session.defaultSession, {
			url: 'http://localhost:3375',
			name: 'test',
			value: '1234',
		});
		await setCookie(session.defaultSession, {
			url: 'http://localhost:3375',
			name: 'test2',
			value: 'ABCD',
		});
		await setCookie(session.defaultSession, {
			url: 'http://example.com:3375',
			name: 'test3',
			value: '1234',
		});
		requestStub = sinon.stub(net, 'request').callsFake((opts, cb) => {
			const emitter = new EventEmitter();
			emitter.end = () => { };
			cb(emitter);
			emitter.emit('end');
		});
	});


	before((done) => {
		const manifest = {
			'secure-electron-adapter': {
				logger: {
					logLevel: 'warn'
				}
			}
		};

		CommonConfig.initManifestWithDefaults(manifest);
		done();
	});

	it('Should set a cookie', async () => {
		const cookie = await getCookieHeader(session.defaultSession, 'localhost');
		expect(cookie).to.equal('test=1234;test2=ABCD;');
	});

	it('Should pass cookies from session into download', async () => {
		const downloadOptions = {};
		const Cookie = await getCookieHeader(session.defaultSession, 'localhost');
		if (Cookie) {
			downloadOptions.headers = {
				Cookie,
			};
		}
		await download('http://google.com/test.zip', downloadOptions);
		const cookieValue = requestStub.getCall(0).args[0].headers.Cookie;
		expect(cookieValue).to.equal('test=1234;test2=ABCD;');
	});

	after((done) => {
		CommonConfig.initManifestWithDefaults({});
		done();
	});

	afterEach(async () => {
		requestStub.restore();
		session.defaultSession.clearStorageData(); // reset cookies
	});
});
