const chai = require('chai');
const download = require('../common/download');
const { setCookie, getCookieHeader } = require('../common/helpers');
const sinon = require('sinon');
const { net } = require('electron');
const { EventEmitter } = require('events');
const { session } = require('electron');

const expect = chai.expect;

describe('download', () => {
	let requestStub;
	beforeEach(async () => {
		await setCookie(session.defaultSession, {
			url: 'http://localhost:3375',
			name: 'test',
			value: '1234',
		});
		requestStub = sinon.stub(net, 'request').callsFake((opts, cb) => {
			const emitter = new EventEmitter();
			emitter.end = () => { };
			cb(emitter);
			emitter.emit('end');
		});
		sinon.spy(requestStub);
	});

	context('Proper behavior', () => {
		it('Should set a cookie', async () => {
			const cookie = await getCookieHeader(session.defaultSession);
			expect(cookie).to.equal('test=1234;');
		});

		it('Should pass cookies from session into download', async () => {
			const downloadOptions = {};
			const Cookie = await getCookieHeader(session.defaultSession);
			if (Cookie) {
				downloadOptions.headers = {
					Cookie,
				};
			}
			await download('http://google.com/test.zip', downloadOptions);
			const cookieValue = requestStub.getCall(0).args[0].headers.Cookie;
			expect(cookieValue).to.equal('test=1234;');
		});
	});

	afterEach(async () => {
		requestStub.restore();
		session.defaultSession.clearStorageData(); // reset cookies
	});
});
