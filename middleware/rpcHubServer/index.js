'use strict'
const RpcHubServer = require('./RpcHubServer')
const httpConnQueue = require('./RpcHubServer/httpConnQueue')
const workerUtil = require('ddv-worker/util')
module.exports = function rpcHubServerMiddleware (options) {
  return function rpcHubServer (req, res, next) {
    var close = e => {
      httpConnQueue && httpConnQueue[req.requestId] && workerUtil.isFunction(httpConnQueue[req.requestId].destroy) && httpConnQueue[req.requestId].destroy()
      delete httpConnQueue[req.requestId]
    }
    httpConnQueue[req.requestId] = new RpcHubServer(options, req, res, next)
    res.on('end', close)
    close = void 0
  }
}
