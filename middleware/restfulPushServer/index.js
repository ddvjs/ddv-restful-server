'use strict'
module.exports = restfulPushServerMiddleware
function restfulPushServerMiddleware (ws, req) {
  ws.on('message', function (msg) {
    console.log(msg, 'test')
    ws.send('restfulPushServer' + msg + 'test')
  })
  console.log('socket', req.testing)
}
