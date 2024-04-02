const test = require('tape')
const Peer = require('../')
const common = require('./common')

let config
test('get config', (t) => {
  common.getConfig((err, _config) => {
    if (err)
      return t.fail(err)
    config = _config
    t.end()
  })
})

test('data send/receive Uint8Array', (t) => {
  t.plan(6)

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc })
  const peer2 = new Peer({ config, wrtc: common.wrtc })
  peer1.on('signal', (data) => {
    peer2.signal(data)
  })
  peer2.on('signal', (data) => {
    peer1.signal(data)
  })
  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest() {
    if (!peer1.connected || !peer2.connected)
      return

    peer1.send(new Uint8Array([0, 1, 2]))
    peer2.on('data', (data) => {
      t.ok(data instanceof Uint8Array, 'data is Uint8Array')
      t.deepEqual(data, Uint8Array.from([0, 1, 2]), 'got correct message')

      peer2.send(new Uint8Array([0, 2, 4]))
      peer1.on('data', (data) => {
        t.ok(data instanceof Uint8Array, 'data is Uint8Array')
        t.deepEqual(data, Uint8Array.from([0, 2, 4]), 'got correct message')

        peer1.on('close', () => { t.pass('peer1 destroyed') })
        peer1.destroy()
        peer2.on('close', () => { t.pass('peer2 destroyed') })
        peer2.destroy()
      })
    })
  }
})

test('data send/receive ArrayBuffer', (t) => {
  t.plan(6)

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc })
  const peer2 = new Peer({ config, wrtc: common.wrtc })
  peer1.on('signal', (data) => {
    peer2.signal(data)
  })
  peer2.on('signal', (data) => {
    peer1.signal(data)
  })
  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest() {
    if (!peer1.connected || !peer2.connected)
      return

    peer1.send(new Uint8Array([0, 1, 2]).buffer)
    peer2.on('data', (data) => {
      // ArrayBuffer gets converted to Uint8Array!
      t.ok(data instanceof Uint8Array, 'data is Uint8Array')
      t.deepEqual(data, Uint8Array.from([0, 1, 2]), 'got correct message')

      peer2.send(new Uint8Array([0, 2, 4]).buffer)
      peer1.on('data', (data) => {
        t.ok(data instanceof Uint8Array, 'data is Uint8Array')
        t.deepEqual(data, Uint8Array.from([0, 2, 4]), 'got correct message')

        peer1.on('close', () => { t.pass('peer1 destroyed') })
        peer1.destroy()
        peer2.on('close', () => { t.pass('peer2 destroyed') })
        peer2.destroy()
      })
    })
  }
})
