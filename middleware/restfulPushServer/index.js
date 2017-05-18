'use strict'
const PushEvent = require('./pushEvent.js')
const wsConnQueue = require('./wsConnQueue.js')
module.exports = function restfulPushServerMiddleware (options) {
  return function restfulPushServer (ws, req) {
    wsConnQueue[req.requestId] = new PushEvent(options, ws, req)
  }
}
