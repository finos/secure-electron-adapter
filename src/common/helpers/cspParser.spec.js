const { expect } = require('chai');
const sinon = require('sinon');
const CSPParser = require('./cspParser');

describe('src/common/helpers/cspParser.js', () => {
	let rawCsp;
	let parser;
	beforeEach(() => {
		rawCsp = "default-src 'none'; connect-src 'self' uploads.github.com";
		sinon.spy(CSPParser.prototype, 'convertToObject');
		parser = new CSPParser(rawCsp);
	});
	afterEach(() => {
		// restore spy once done
		CSPParser.prototype.convertToObject.restore();
	});
	it('Should throw a TypeError if the passed csp is not a string', () => {
		const func = () => new CSPParser({});
		expect(func).to.throw(TypeError);
	});
	it('Should be an instance of CSPParser', () => {
		expect(parser).to.be.instanceOf(CSPParser);
	});
	it('Should call convertToObject() once', () => {
		expect(parser.convertToObject.calledOnce).to.be.true;
	});
	it('Should generates a valid directives object', () => {
		const expectedObj = {
			'default-src': "'none'",
			'connect-src': "'self' uploads.github.com"
		};
		expect(parser.getObject()).to.deep.equal(expectedObj);
	});
	it('Should allow checking a directive with has()', () => {
		expect(parser.has('default-src')).to.be.true;
		expect(parser.has('xx-src')).to.be.false;
	});
	it('Should delete a directive with delete()', () => {
		const expectedObj = {
			'connect-src': "'self' uploads.github.com"
		};
		parser.delete('default-src');
		expect(parser.getObject()).to.deep.equal(expectedObj);
	});
	it('Should return a valid modified string with toString()', () => {
		const expectedStr = "connect-src 'self' uploads.github.com;";
		parser.delete('default-src');
		expect(parser.toString()).to.equal(expectedStr);
	});
});
