'use strict'
module.exports = rpcServerMiddleware
function rpcServerMiddleware (ws, req) {
  ws.on('message', function (msg) {
    console.log(msg, 'test')
    ws.send('rpcServer' + msg + 'test')
  })
  console.log('socket', req.testing)
}
