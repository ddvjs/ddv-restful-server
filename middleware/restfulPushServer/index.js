'use strict'
module.exports = function restfulPushServerMiddleware (options) {
  return function restfulPushServer (ws, req) {
    ws.on('message', function (msg) {
      console.log(msg, 'test')
      ws.send('restfulPushServer' + msg + 'test')
    })
    console.log('socket', req.testing)
  }
}
