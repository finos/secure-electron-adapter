const stringifyProperty = require('./stringifyProperty');

const { expect } = require('chai');

const obj = {
	property1: undefined,
	property2: null,
	property3: false,
	property4: {
		subProperty41: 'value'
	}
};
obj.obj = obj;
describe('SafeStringify Helper', () => {
	it('should stringify an undefined property', () => {
		expect(stringifyProperty(obj, 'property1')).to.not.throw;
		expect(stringifyProperty(obj, 'property1')).to.equal('');
	});
	it('should stringify a null property without throwing', () => {
		expect(stringifyProperty(obj, 'property2')).to.not.throw;
		expect(stringifyProperty(obj, 'property2')).to.equal('');
	});

	it('should stringify a key that doesn\'t exist without throwing', () => {
		expect(stringifyProperty(obj, 'property13333')).to.not.throw;
		expect(stringifyProperty(obj, 'property13333')).to.equal('');
	});

	it('should stringify a circular property without throwing', () => {
		expect(stringifyProperty(obj, 'obj')).to.not.throw;
	});
});
