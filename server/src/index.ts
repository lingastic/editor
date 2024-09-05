#!/usr/bin/env node-ts

/**
 * Module dependencies.
 */

const mainApp = require('./app');
const debug = require('debug')('demo:server');
const http = require('http');
const Db = require('./db');
const db = new Db();

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || '5000');

/**
 * Create HTTP server.
 */

const server = http.createServer(mainApp.callback());

// set up socket.io
const io = require('socket.io')(server, {});

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
  socket.join('all clients');
});

db.listenDbEvents('pages_change', 'anon', function (msg) {
  const payload = JSON.parse(msg.payload);
  io.to('all clients').emit('page changed', payload.name);
});
/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
