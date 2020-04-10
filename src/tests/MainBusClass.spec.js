const proxyquire = require('proxyquire')
const sinon = require('sinon')
const { assert } = require('chai')
const { ipcMain, ipcRenderer } = require('electron-ipc-mock')()
const { _events } = ipcMain._emitter

const MainBus = proxyquire('../main/MainBusClass', {
	'../permissions/PermissionsManager': {
		// Testing other modules is not within the scope
		// So let's fake this one.
		checkPermission: sinon.fake.returns(true)
	},
	'electron': {
		// We can not use the real ipcMain here
		// Using one from electron-ipc-mock.
		ipcMain
	}
})

// A fake electron event with a sender.send method
// that simply wraps ipcRenderer.send method.
function newEvent() {
	const id = Math.random()
	return {
		senderUUID: id,
		appUUID: id,
		sender: {
			id,
			send: (...args) => {
				ipcRenderer.send(...args)
			},
			browserWindowOptions: {
				name: id
			},
			getOwnerBrowserWindow: () => {
				return { appUUID: id };
			}
		}
	}
}

// Fake mainWindowProcessManager's findWindowByName
process.mainWindowProcessManager = {
	findWindowByName: sinon.fake.returns({})
}

describe('MainBus.js', () => {
	const event = newEvent()
	const topic = 'mytopic'
	describe('Methods', () => {
		const mainBus = new MainBus()
		it('Implements unsubscribeWindow', () => {
			assert.isFunction(mainBus.unsubscribeWindow)
		})
		it('Implements handleMainRequest', () => {
			assert.isFunction(mainBus.handleMainRequest)
		})
		it('Implements addSystemListener', () => {
			assert.isFunction(mainBus.addSystemListener)
		})
		it('Implements removeSystemListener', () => {
			assert.isFunction(mainBus.removeSystemListener)
		})
		it('Implements removeSystemListener', () => {
			assert.isFunction(mainBus.removeSystemListener)
		})
		it('Implements setupMainListener', () => {
			assert.isFunction(mainBus.setupMainListener)
		})
		it('Implements sendEvent', () => {
			assert.isFunction(mainBus.sendEvent)
		})
		it('Implements onIPCSubscribe', () => {
			assert.isFunction(mainBus.onIPCSubscribe)
		})
		it('Implements onIPCUnsubscribe', () => {
			assert.isFunction(mainBus.onIPCUnsubscribe)
		})
		it('Implements onIPCPublish', () => {
			assert.isFunction(mainBus.onIPCPublish)
		})
		it('Implements setupIPC', () => {
			assert.isFunction(mainBus.setupIPC)
		})
	})

	describe('Instantiation', () => {
		const spy1 = sinon.spy(MainBus.prototype, 'setupMainListener')
		const spy2 = sinon.spy(MainBus.prototype, 'setupIPC')
		new MainBus()
		it('Invokes setupMainListener()', () => {
			sinon.assert.calledOnce(spy1)
		})
		it('Invokes setupIPC()', () => {
			sinon.assert.calledOnce(spy2)
		})
		it('Registers sea.mainRequest handler', () => {
			assert.exists(_events['sea.mainRequest'])
		})
		it('Registers system.addlistener handler', () => {
			assert.exists(_events['system.addlistener'])
		})
		it('Registers system.removelistener handler', () => {
			assert.exists(_events['system.removelistener'])
		})
		it('Registers sea.subscribe handler', () => {
			assert.exists(_events['sea.subscribe'])
		})
		it('Registers sea.unSubscribe handler', () => {
			assert.exists(_events['sea.unSubscribe'])
		})
		it('Registers sea.publish handler', () => {
			assert.exists(_events['sea.publish'])
		})
		spy1.restore()
		spy2.restore()
	})

	describe('addSystemListener() removeSystemListener()', () => {
		const mainBus = new MainBus()
		it('Adds listeners', () => {
			mainBus.addSystemListener(event, topic)
			assert.exists(mainBus.listeners[topic][event.sender.id])
		})
		it('Removes listeners', () => {
			mainBus.removeSystemListener(event, topic)
			assert.notExists(mainBus.listeners[topic][event.sender.id])
		})
	})

	describe('onIPCSubscribe() onIPCUnSubscribe()', () => {
		const mainBus = new MainBus()
		const { subscribers } = mainBus
		it('Adds a subscriber', async () => {
			await mainBus.onIPCSubscribe(event, {
				topic,
				subscribeUUID: event.sender.id
			})
			assert.exists(subscribers[topic][event.sender.id])
		})

		it('Deletes a subscriber', async () => {
			await mainBus.onIPCUnsubscribe(event, {
				topic,
				subscribeUUID: event.sender.id
			})
			assert.notExists(subscribers[topic][event.sender.id])
		})

	})

	describe('sendEvent()', () => {
		it('Sends an event to all listeners', () => {
			const mainBus = new MainBus()
			const spy = sinon.spy(ipcRenderer, 'send')
			// Generate some system listeners
			for (let i = 0; i < 3; i++) {
				mainBus.addSystemListener(newEvent(), topic)
			}
			// Call sendEvent() to invoke ipcRenderer.send()
			mainBus.sendEvent(topic, {})
			assert.equal(spy.callCount, 3)
			spy.restore()
		})
	})

	describe('onIPCPublish()', () => {
		it('Sends subscribeResponse through ipc', async () => {
			const spy = sinon.spy(ipcRenderer, 'send')
			const { id } = event.sender
			const mainBus = new MainBus()
			// Let's add a subscriber
			await mainBus.onIPCSubscribe(event, {
				topic,
				senderUUID: '*',
				subscribeUUID: id
			})
			// Let's publish something
			await mainBus.onIPCPublish(event, { topic })
			// Make sure that function being tested invokes
			// ipcRenderer.send. You may wonder why doesn't this
			// test validates the data sent via ipc? well we are not testing IPC
			// we assume that IPC is already tested. onIPCPublish()
			// does many things. it should really be broken down into pieces
			// subscribeResponse's data could be constructed using another
			// testable function. Rightnow the only way to test that data
			// is by testing ipcRenderer!
			sinon.assert.calledOnce(spy)
		})
	})

	describe('unsubscribeWindow()', () => {
		it('Deletes all subscribers for a window by name', async () => {
			const mainBus = new MainBus()
			const { id } = event.sender
			const topicWithName = `sub-${id}`
			await mainBus.onIPCSubscribe(event, {
				topic: topicWithName,
				subscribeUUID: id
			})
			// Already tested above, but lets double check
			assert.exists(mainBus.subscribers[topicWithName])
			// Now let's delete all subscribers (id = name)
			mainBus.unsubscribeWindow(id)
			assert.notExists(mainBus.subscribers[topicWithName])

		})
	})

})