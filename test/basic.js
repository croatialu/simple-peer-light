import process from 'node:process'
import { test } from '@playwright/test'
import { getConfig } from './common'
import Peer from './..'

let config
test('get config', (t) => {
  getConfig((err, _config) => {
    if (err)
      return t.fail(err)
    config = _config
    t.end()
  })
})

test('detect WebRTC support', (t) => {
  t.equal(Peer.WEBRTC_SUPPORT, typeof window !== 'undefined', 'builtin webrtc support')
  t.end()
})

test('create peer without options', (t) => {
  t.plan(1)

  if (process.browser) {
    let peer
    t.doesNotThrow(() => {
      peer = new Peer()
    })
    peer.destroy()
  }
  else {
    t.pass('Skip no-option test in Node.js, since the wrtc option is required')
  }
})

test('can detect error when RTCPeerConstructor throws', (t) => {
  t.plan(1)

  const peer = new Peer({ wrtc: { RTCPeerConnection: null } })
  peer.once('error', () => {
    t.pass('got error event')
    peer.destroy()
  })
})

test('signal event gets emitted', (t) => {
  t.plan(2)

  const peer = new Peer({ config, initiator: true, wrtc })
  peer.once('signal', () => {
    t.pass('got signal event')
    peer.on('close', () => { t.pass('peer destroyed') })
    peer.destroy()
  })
})

test('signal event does not get emitted by non-initiator', (t) => {
  const peer = new Peer({ config, initiator: false, wrtc: common.wrtc })
  peer.once('signal', () => {
    t.fail('got signal event')
    peer.on('close', () => { t.pass('peer destroyed') })
    peer.destroy()
  })

  setTimeout(() => {
    t.pass('did not get signal after 1000ms')
    t.end()
  }, 1000)
})

test('signal event does not get emitted by non-initiator with stream', (t) => {
  const peer = new Peer({
    config,
    stream: common.getMediaStream(),
    initiator: false,
    wrtc: common.wrtc,
  })
  peer.once('signal', () => {
    t.fail('got signal event')
    peer.on('close', () => { t.pass('peer destroyed') })
    peer.destroy()
  })

  setTimeout(() => {
    t.pass('did not get signal after 1000ms')
    t.end()
  }, 1000)
})

test('data send/receive text', (t) => {
  t.plan(8)

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc })
  const peer2 = new Peer({ config, wrtc: common.wrtc })

  let numSignal1 = 0
  peer1.on('signal', (data) => {
    numSignal1 += 1
    peer2.signal(data)
  })

  let numSignal2 = 0
  peer2.on('signal', (data) => {
    numSignal2 += 1
    peer1.signal(data)
  })

  peer1.on('connect', tryTest)
  peer2.on('connect', tryTest)

  function tryTest() {
    if (!peer1.connected || !peer2.connected)
      return

    t.ok(numSignal1 >= 1)
    t.ok(numSignal2 >= 1)
    t.equal(peer1.initiator, true, 'peer1 is initiator')
    t.equal(peer2.initiator, false, 'peer2 is not initiator')

    peer1.send('sup peer2')
    peer2.on('data', (data) => {
      t.equal(data, 'sup peer2', 'got correct message')

      peer2.send('sup peer1')
      peer1.on('data', (data) => {
        t.equal(data, 'sup peer1', 'got correct message')

        peer1.on('close', () => { t.pass('peer1 destroyed') })
        peer1.destroy()
        peer2.on('close', () => { t.pass('peer2 destroyed') })
        peer2.destroy()
      })
    })
  }
})

test('sdpTransform function is called', (t) => {
  t.plan(3)

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc })
  const peer2 = new Peer({ config, sdpTransform, wrtc: common.wrtc })

  function sdpTransform(sdp) {
    t.equal(typeof sdp, 'string', 'got a string as SDP')
    setTimeout(() => {
      peer1.on('close', () => { t.pass('peer1 destroyed') })
      peer1.destroy()
      peer2.on('close', () => { t.pass('peer2 destroyed') })
      peer2.destroy()
    }, 0)
    return sdp
  }

  peer1.on('signal', (data) => {
    peer2.signal(data)
  })

  peer2.on('signal', (data) => {
    peer1.signal(data)
  })
})

test('old constraint formats are used', (t) => {
  t.plan(3)

  const constraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true,
    },
  }

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc, constraints })
  const peer2 = new Peer({ config, wrtc: common.wrtc, constraints })

  peer1.on('signal', (data) => {
    peer2.signal(data)
  })

  peer2.on('signal', (data) => {
    peer1.signal(data)
  })

  peer1.on('connect', () => {
    t.pass('peers connected')
    peer1.on('close', () => { t.pass('peer1 destroyed') })
    peer1.destroy()
    peer2.on('close', () => { t.pass('peer2 destroyed') })
    peer2.destroy()
  })
})

test('new constraint formats are used', (t) => {
  t.plan(3)

  const constraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  }

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc, constraints })
  const peer2 = new Peer({ config, wrtc: common.wrtc, constraints })

  peer1.on('signal', (data) => {
    peer2.signal(data)
  })

  peer2.on('signal', (data) => {
    peer1.signal(data)
  })

  peer1.on('connect', () => {
    t.pass('peers connected')
    peer1.on('close', () => { t.pass('peer1 destroyed') })
    peer1.destroy()
    peer2.on('close', () => { t.pass('peer2 destroyed') })
    peer2.destroy()
  })
})

test('ensure remote address and port are available right after connection', (t) => {
  if (common.isBrowser('safari') || common.isBrowser('ios')) {
    t.pass('Skip on Safari and iOS which do not support modern getStats() calls')
    t.end()
    return
  }
  if (common.isBrowser('chrome') || common.isBrowser('edge')) {
    t.pass('Skip on Chrome and Edge which hide local IPs with mDNS')
    t.end()
    return
  }

  t.plan(7)

  const peer1 = new Peer({ config, initiator: true, wrtc: common.wrtc })
  const peer2 = new Peer({ config, wrtc: common.wrtc })

  peer1.on('signal', (data) => {
    peer2.signal(data)
  })

  peer2.on('signal', (data) => {
    peer1.signal(data)
  })

  peer1.on('connect', () => {
    t.pass('peers connected')

    t.ok(peer1.remoteAddress, 'peer1 remote address is present')
    t.ok(peer1.remotePort, 'peer1 remote port is present')

    peer2.on('connect', () => {
      t.ok(peer2.remoteAddress, 'peer2 remote address is present')
      t.ok(peer2.remotePort, 'peer2 remote port is present')

      peer1.on('close', () => { t.pass('peer1 destroyed') })
      peer1.destroy()
      peer2.on('close', () => { t.pass('peer2 destroyed') })
      peer2.destroy()
    })
  })
})

test('ensure iceStateChange fires when connection failed', (t) => {
  t.plan(1)
  const peer = new Peer({ config, initiator: true, wrtc: common.wrtc })

  peer.on('iceStateChange', (connectionState, gatheringState) => {
    t.pass('got iceStateChange')
    t.end()
  })

  // simulate concurrent iceConnectionStateChange and destroy()
  peer.destroy()
  peer._pc.oniceconnectionstatechange()
})
