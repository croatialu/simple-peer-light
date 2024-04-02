// run in a terminal, to do signaling for peers

const ws = require('ws')

const server = new ws.Server({
  port: 8080,
})

const sockets = []

server.on('connection', (socket) => {
  sockets.push(socket)
  socket.on('message', onMessage)
  socket.on('close', () => {
    sockets.splice(sockets.indexOf(socket), 1)
  })

  function onMessage(message) {
    sockets
      .filter(s => s !== socket)
      .forEach(socket => socket.send(message))
  }

  if (sockets.length === 2)
    sockets.forEach(socket => socket.send('ready'))
})
