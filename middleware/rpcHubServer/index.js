'use strict'
const RpcCall = require('./RpcCall.js')
const httpConnQueue = require('./httpConnQueue.js')
const workerUtil = require('ddv-worker/util')
module.exports = function rpcHubServerMiddleware (options) {
  return function rpcHubServer (req, res, next) {
    var close = e => {
      httpConnQueue && httpConnQueue[req.requestId] && workerUtil.isFunction(httpConnQueue[req.requestId].destroy) && httpConnQueue[req.requestId].destroy()
      delete httpConnQueue[req.requestId]
    }
    httpConnQueue[req.requestId] = new RpcCall(options, req, res, next)
    res.on('end', close)
    close = void 0
  }
}
