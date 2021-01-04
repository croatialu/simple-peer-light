# simple-peer-light [![npm][npm-image]][npm-url] [![downloads][downloads-image]][downloads-url] [![javascript style guide][standard-image]][standard-url]

[npm-image]: https://img.shields.io/npm/v/simple-peer.svg
[npm-url]: https://npmjs.org/package/simple-peer
[downloads-image]: https://img.shields.io/npm/dm/simple-peer.svg
[downloads-url]: https://npmjs.org/package/simple-peer
[standard-image]: https://img.shields.io/badge/code_style-standard-brightgreen.svg
[standard-url]: https://standardjs.com

This is a light-weight, browser-friendly fork of [feross/simple-peer](https://github.com/feross/simple-peer):

- Zero external dependencies
- Bundle size reduced from 28 kB to **5 kB** (minified, gzipped)
- Can be directly imported in a `<script type="module">` without bundling

**Caveats compared to [feross/simple-peer](https://github.com/feross/simple-peer)**

- The `Peer` class does not inherit from `Duplex`, which means it does not support node's stream API. Instead, I added basic EventEmitter-style methods `.on()`, `.off()`, `.once()` and `.emit()`.
- Because `index.js` uses an ESM export instead of CJS, it does not work in node. So this fork is for the browser only!
- For the same reason, the browser tests can also not be executed. However, I did update the tests to reflect the API changes and made sure all tests pass if a CJS export is used in `index.js`.

I updated the documentation below to reflect these changes.

**WARNING:** I made this fork for my personal use and do NOT intend to keep it up to date with changes in [feross/simple-peer](https://github.com/feross/simple-peer).

#### Simple WebRTC video, voice, and data channels

## features

- concise, **node.js style** API for [WebRTC](https://en.wikipedia.org/wiki/WebRTC)
- supports **video/voice streams**
- supports **data channel**
  - text and binary data
- supports advanced options like:
  - enable/disable [trickle ICE candidates](http://webrtchacks.com/trickle-ice/)
  - manually set config options
  - transceivers and renegotiation

- [install](#install)
- [examples](#usage)
  * [A simpler example](#a-simpler-example)
  * [data channels](#data-channels)
  * [video/voice](#videovoice)
  * [dynamic video/voice](#dynamic-videovoice)
- [api](#api)
- [error codes](#error-codes)
- [connecting more than 2 peers?](#connecting-more-than-2-peers)
- [memory usage](#memory-usage)
- [connection does not work on some networks?](#connection-does-not-work-on-some-networks)
- [license](#license)

## install

```
npm install simple-peer-light
```

This package works in the browser without modification. The `simplepeer.min.js` script is just a minified version for usage without a build pipeline.

## usage

Let's create an html page that lets you manually connect two peers:

```html
<html>
  <body>
    <style>
      #outgoing {
        width: 600px;
        word-wrap: break-word;
        white-space: normal;
      }
    </style>
    <form>
      <textarea id="incoming"></textarea>
      <button type="submit">submit</button>
    </form>
    <pre id="outgoing"></pre>
    <script>
      import Peer from './simplepeer.min.js'
      const p = new Peer({
        initiator: location.hash === '#1',
        trickle: false
      })

      p.on('error', err => console.log('error', err))

      p.on('signal', data => {
        console.log('SIGNAL', JSON.stringify(data))
        document.querySelector('#outgoing').textContent = JSON.stringify(data)
      })

      document.querySelector('form').addEventListener('submit', ev => {
        ev.preventDefault()
        p.signal(JSON.parse(document.querySelector('#incoming').value))
      })

      p.on('connect', () => {
        console.log('CONNECT')
        p.send('whatever' + Math.random())
      })

      p.on('data', data => {
        console.log('data: ' + data)
      })
    </script>
  </body>
</html>
```

Visit `index.html#1` from one browser (the initiator) and `index.html` from another
browser (the receiver).

An "offer" will be generated by the initiator. Paste this into the receiver's form and
hit submit. The receiver generates an "answer". Paste this into the initiator's form and
hit submit.

Now you have a direct P2P connection between two browsers!

### A simpler example

This example create two peers **in the same web page**.

In a real-world application, *you would never do this*. The sender and receiver `Peer`
instances would exist in separate browsers. A "signaling server" (usually implemented with
websockets) would be used to exchange signaling data between the two browsers until a
peer-to-peer connection is established.

### data channels

```js
import Peer from 'simple-peer-light'

var peer1 = new Peer({ initiator: true })
var peer2 = new Peer()

peer1.on('signal', data => {
  // when peer1 has signaling data, give it to peer2 somehow
  peer2.signal(data)
})

peer2.on('signal', data => {
  // when peer2 has signaling data, give it to peer1 somehow
  peer1.signal(data)
})

peer1.on('connect', () => {
  // wait for 'connect' event before using the data channel
  peer1.send('hey peer2, how is it going?')
})

peer2.on('data', data => {
  // got a data channel message
  console.log('got a message from peer1: ' + data)
})
```

### video/voice

Video/voice is also super simple! In this example, peer1 sends video to peer2.

```js
import Peer from 'simple-peer-light'

// get video/voice stream
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(gotMedia).catch(() => {})

function gotMedia (stream) {
  var peer1 = new Peer({ initiator: true, stream: stream })
  var peer2 = new Peer()

  peer1.on('signal', data => {
    peer2.signal(data)
  })

  peer2.on('signal', data => {
    peer1.signal(data)
  })

  peer2.on('stream', stream => {
    // got remote video stream, now let's show it in a video tag
    var video = document.querySelector('video')

    if ('srcObject' in video) {
      video.srcObject = stream
    } else {
      video.src = window.URL.createObjectURL(stream) // for older browsers
    }

    video.play()
  })
}
```

For two-way video, simply pass a `stream` option into both `Peer` constructors. Simple!

Please notice that `getUserMedia` only works in [pages loaded via **https**](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Encryption_based_security).

### dynamic video/voice

It is also possible to establish a data-only connection at first, and later add
a video/voice stream, if desired.

```js
import Peer from 'simple-peer-light' // create peer without waiting for media

var peer1 = new Peer({ initiator: true }) // you don't need streams here
var peer2 = new Peer()

peer1.on('signal', data => {
  peer2.signal(data)
})

peer2.on('signal', data => {
  peer1.signal(data)
})

peer2.on('stream', stream => {
  // got remote video stream, now let's show it in a video tag
  var video = document.querySelector('video')

  if ('srcObject' in video) {
    video.srcObject = stream
  } else {
    video.src = window.URL.createObjectURL(stream) // for older browsers
  }

  video.play()
})

function addMedia (stream) {
  peer1.addStream(stream) // <- add streams to peer dynamically
}

// then, anytime later...
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(addMedia).catch(() => {})
```

## api

### `peer = new Peer([opts])`

Create a new WebRTC peer connection.

A "data channel" for text/binary communication is always established, because it's cheap and often useful. For video/voice communication, pass the `stream` option.

If `opts` is specified, then the default options (shown below) will be overridden.

```
{
  initiator: false,
  channelConfig: {},
  channelName: '<random string>',
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] },
  offerOptions: {},
  answerOptions: {},
  sdpTransform: function (sdp) { return sdp },
  stream: false,
  streams: [],
  trickle: true,
  allowHalfTrickle: false,
  wrtc: {}, // RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
}
```

The options do the following:

- `initiator` - set to `true` if this is the initiating peer
- `channelConfig` - custom webrtc data channel configuration (used by [`createDataChannel`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel))
- `channelName` - custom webrtc data channel name
- `config` - custom webrtc configuration (used by [`RTCPeerConnection`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection) constructor)
- `offerOptions` - custom offer options (used by [`createOffer`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer) method)
- `answerOptions` - custom answer options (used by [`createAnswer`](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createAnswer) method)
- `sdpTransform` - function to transform the generated SDP signaling data (for advanced users)
- `stream` - if video/voice is desired, pass stream returned from [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- `streams` - an array of MediaStreams returned from [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- `trickle` - set to `false` to disable [trickle ICE](http://webrtchacks.com/trickle-ice/) and get a single 'signal' event (slower)
- `wrtc` - custom webrtc implementation, mainly useful in node to specify in the [wrtc](https://npmjs.com/package/wrtc) package. Contains an object with the properties:
  - [`RTCPeerConnection`](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection)
  - [`RTCSessionDescription`](https://www.w3.org/TR/webrtc/#dom-rtcsessiondescription)
  - [`RTCIceCandidate`](https://www.w3.org/TR/webrtc/#dom-rtcicecandidate)


### `peer.signal(data)`

Call this method whenever the remote peer emits a `peer.on('signal')` event.

The `data` will encapsulate a webrtc offer, answer, or ice candidate. These messages help
the peers to eventually establish a direct connection to each other. The contents of these
strings are an implementation detail that can be ignored by the user of this module;
simply pass the data from 'signal' events to the remote peer and call `peer.signal(data)`
to get connected.

### `peer.send(data)`

Send text/binary data to the remote peer. `data` can be any of several types: `String`,
`ArrayBufferView` (`Uint8Array`,
etc.), `ArrayBuffer`, or `Blob` (in browsers that support it).

Note: If this method is called before the `peer.on('connect')` event has fired, then an exception will be thrown.

### `peer.addStream(stream)`

Add a `MediaStream` to the connection.

### `peer.removeStream(stream)`

Remove a `MediaStream` from the connection.

### `peer.addTrack(track, stream)`

Add a `MediaStreamTrack` to the connection. Must also pass the `MediaStream` you want to attach it to.

### `peer.removeTrack(track, stream)`

Remove a `MediaStreamTrack` from the connection. Must also pass the `MediaStream` that it was attached to.

### `peer.replaceTrack(oldTrack, newTrack, stream)`

Replace a `MediaStreamTrack` with another track. Must also pass the `MediaStream` that the old track was attached to.

### `peer.addTransceiver(kind, init)`

Add a `RTCRtpTransceiver` to the connection. Can be used to add transceivers before adding tracks. Automatically called as neccesary by `addTrack`.

### `peer.destroy([err])`

Destroy and cleanup this peer connection.

If the optional `err` parameter is passed, then it will be emitted as an `'error'`
event on the stream.

### `Peer.WEBRTC_SUPPORT`

Detect native WebRTC support in the javascript environment.

```js
import Peer from 'simple-peer-light'

if (Peer.WEBRTC_SUPPORT) {
  // webrtc support!
} else {
  // fallback
}
```

### `peer.on('signal', data => {})`

Fired when the peer wants to send signaling data to the remote peer.

**It is the responsibility of the application developer (that's you!) to get this data to
the other peer.** This usually entails using a websocket signaling server. This data is an
`Object`, so  remember to call `JSON.stringify(data)` to serialize it first. Then, simply
call `peer.signal(data)` on the remote peer.

(Be sure to listen to this event immediately to avoid missing it. For `initiator: true`
peers, it fires right away. For `initatior: false` peers, it fires when the remote
offer is received.)

### `peer.on('connect', () => {})`

Fired when the peer connection and data channel are ready to use.

### `peer.on('data', data => {})`

Received a message from the remote peer (via the data channel).

`data` will be either a `String` or a `Uint8Array`.

### `peer.on('stream', stream => {})`

Received a remote video stream, which can be displayed in a video tag:

```js
peer.on('stream', stream => {
  var video = document.querySelector('video')
  if ('srcObject' in video) {
    video.srcObject = stream
  } else {
    video.src = window.URL.createObjectURL(stream)
  }
  video.play()
})
```

### `peer.on('track', (track, stream) => {})`

Received a remote audio/video track. Streams may contain multiple tracks.

### `peer.on('close', () => {})`

Called when the peer connection has closed.

### `peer.on('error', (err) => {})`

Fired when a fatal error occurs. Usually, this means bad signaling data was received from the remote peer.

`err` is an `Error` object.

## error codes

Errors returned by the `error` event have an `err.code` property that will indicate the origin of the failure.

Possible error codes:
- `ERR_WEBRTC_SUPPORT`
- `ERR_CREATE_OFFER`
- `ERR_CREATE_ANSWER`
- `ERR_SET_LOCAL_DESCRIPTION`
- `ERR_SET_REMOTE_DESCRIPTION`
- `ERR_ADD_ICE_CANDIDATE`
- `ERR_ICE_CONNECTION_FAILURE`
- `ERR_SIGNALING`
- `ERR_DATA_CHANNEL`
- `ERR_CONNECTION_FAILURE`


## connecting more than 2 peers?

The simplest way to do that is to create a full-mesh topology. That means that every peer
opens a connection to every other peer. To illustrate:

![full mesh topology](img/full-mesh.png)

To broadcast a message, just iterate over all the peers and call `peer.send`.

So, say you have 3 peers. Then, when a peer wants to send some data it must send it 2
times, once to each of the other peers. So you're going to want to be a bit careful about
the size of the data you send.

Full mesh topologies don't scale well when the number of peers is very large. The total
number of edges in the network will be ![full mesh formula](img/full-mesh-formula.png)
where `n` is the number of peers.

For clarity, here is the code to connect 3 peers together:

#### Peer 1

```js
// These are peer1's connections to peer2 and peer3
var peer2 = new Peer({ initiator: true })
var peer3 = new Peer({ initiator: true })

peer2.on('signal', data => {
  // send this signaling data to peer2 somehow
})

peer2.on('connect', () => {
  peer2.send('hi peer2, this is peer1')
})

peer2.on('data', data => {
  console.log('got a message from peer2: ' + data)
})

peer3.on('signal', data => {
  // send this signaling data to peer3 somehow
})

peer3.on('connect', () => {
  peer3.send('hi peer3, this is peer1')
})

peer3.on('data', data => {
  console.log('got a message from peer3: ' + data)
})
```

#### Peer 2

```js
// These are peer2's connections to peer1 and peer3
var peer1 = new Peer()
var peer3 = new Peer({ initiator: true })

peer1.on('signal', data => {
  // send this signaling data to peer1 somehow
})

peer1.on('connect', () => {
  peer1.send('hi peer1, this is peer2')
})

peer1.on('data', data => {
  console.log('got a message from peer1: ' + data)
})

peer3.on('signal', data => {
  // send this signaling data to peer3 somehow
})

peer3.on('connect', () => {
  peer3.send('hi peer3, this is peer2')
})

peer3.on('data', data => {
  console.log('got a message from peer3: ' + data)
})
```

#### Peer 3

```js
// These are peer3's connections to peer1 and peer2
var peer1 = new Peer()
var peer2 = new Peer()

peer1.on('signal', data => {
  // send this signaling data to peer1 somehow
})

peer1.on('connect', () => {
  peer1.send('hi peer1, this is peer3')
})

peer1.on('data', data => {
  console.log('got a message from peer1: ' + data)
})

peer2.on('signal', data => {
  // send this signaling data to peer2 somehow
})

peer2.on('connect', () => {
  peer2.send('hi peer2, this is peer3')
})

peer2.on('data', data => {
  console.log('got a message from peer2: ' + data)
})
```

## memory usage

If you call `peer.send(buf)`, `simple-peer-light` is not keeping a reference to `buf`
and sending the buffer at some later point in time. We immediately call
`channel.send()` on the data channel. So it should be fine to mutate the buffer
right afterward.

## connection does not work on some networks?

If a direct connection fails, in particular, because of NAT traversal and/or firewalls,
WebRTC ICE uses an intermediary (relay) TURN server. In other words, ICE will first use
STUN with UDP to directly connect peers and, if that fails, will fall back to a TURN relay
server.

In order to use a TURN server, you must specify the `config` option to the `Peer`
constructor. See the API docs above.

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## license

MIT. Copyright (c) [Feross Aboukhadijeh](http://feross.org).
