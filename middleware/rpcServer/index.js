'use strict'
const RpcEvent = require('./RpcEvent.js')
const wsConnQueue = require('./wsConnQueue.js')
module.exports = function rpcServerMiddleware (options) {
  return function rpcServer (ws, req) {
    wsConnQueue[req.requestId] = new RpcEvent(options, ws, req)
  }
}
