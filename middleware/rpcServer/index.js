'use strict'
module.exports = function rpcServerMiddleware (options) {
  return function rpcServer (ws, req) {
    ws.on('message', function (msg) {
      console.log(msg, 'test')
      ws.send('rpcServer' + msg + 'test')
    })
    console.log('socket', req.testing)
  }
}
