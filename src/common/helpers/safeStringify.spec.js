const stringify = require('./safeStringify');

const { expect } = require('chai');

describe('SafeStringify Helper', () => {
	it('should stringify undefined without throwing', () => {
		expect(stringify(undefined)).to.not.throw;
		expect(stringify(undefined)).to.equal('');
	});

	it('should stringify null without throwing', () => {
		expect(stringify(null)).to.not.throw;
		expect(stringify(null)).to.equal('');
	});

	it('should stringify a circular object without throwing', () => {
		const o = { a: 1 };
		o.o = o;
		expect(stringify(o)).to.not.throw;
	});
});
