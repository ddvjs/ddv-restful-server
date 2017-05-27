'use strict'
module.exports = rpcServerMiddleware
const RpcEvent = require('./RpcEvent.js')
const wsConnQueue = require('./wsConnQueue.js')
const rpcCallByPathEvent = require('./rpcCallByPathEvent.js')
rpcServerMiddleware.rpcCallByPathEvent = rpcCallByPathEvent
rpcServerMiddleware.onPathEvent = onPathEvent

function rpcServerMiddleware (options, rpcCall) {
  return function rpcServer (ws, req) {
    wsConnQueue[req.requestId] = new RpcEvent(options, rpcCall, ws, req)
  }
}
function onPathEvent (path, fn) {
  rpcCallByPathEvent[path] = fn
}
