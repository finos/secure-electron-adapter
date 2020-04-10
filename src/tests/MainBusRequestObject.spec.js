const MainBusRequestObject = require('../main/MainBusRequestObject');
const { assert } = require('chai');

describe('MainBusRequestObject.js', () => {
	describe('Instantiation', () => {
		it('can be instantiated', () => {
			const event = {sender: undefined};
			const args = {topic: "abc", data: {foo : "bar"}};
			let instance = new MainBusRequestObject(event, args, "123");
			assert.equal(instance.sender, undefined);
			assert.equal(instance.rawEvent, event);
			assert.equal(instance.rawArgs, args);
			assert.equal(instance.topic, "abc");
			assert.deepEqual(instance.data, {foo : "bar"});
			assert.equal(instance.responseUUID, "123");
		});
	});

	describe('respondSync()', () => {
		it('sets the raw event return value', () => {
			const event = {sender: undefined};
			const args = {topic: "abc", data: {foo : "bar"}};
			let instance = new MainBusRequestObject(event, args, "123");
			instance.respondSync("blah");
			assert.equal(instance.rawEvent.returnValue, "blah");
		});
	});

	describe('respond()', () => {
		it('does not do anything with an undefined sender', () => {
			const event = {sender: undefined};
			const args = {topic: "abc", data: {foo : "bar"}};
			let instance = new MainBusRequestObject(event, args, "123");
			assert.doesNotThrow(() => instance.respond("blah"));
		});

		it('calls the sender when it is defined', () => {
			let invoked = false;
			const event = {sender: {send : (uuid, response) => {invoked = true;}}};
			const args = {topic: "abc", data: {foo : "bar"}};
			let instance = new MainBusRequestObject(event, args, "123");
			instance.respond("blah");
			assert.ok(invoked);
		});

		it('catches exceptions that the sender throws', () => {
			const event = {sender: {send : (uuid, response) => {throw "error"}}};
			const args = {topic: "abc", data: {foo : "bar"}};
			let instance = new MainBusRequestObject(event, args, "123");
			assert.doesNotThrow(() => instance.respond("blah"));
		});
	});

});
