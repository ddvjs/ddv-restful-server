'use strict'
const PushEvent = require('./PushEvent.js')
const wsConnQueue = require('./wsConnQueue.js')
const workerUtil = require('ddv-worker/util')
const PushError = require('./PushError')
function restfulPushServerMiddleware (options, serverRpcEvent) {
  return function restfulPushServer (ws, req) {
    wsConnQueue[req.requestId] = new PushEvent(options, ws, req)
  }
}
function sendMessageByConnId (connId, headers, body) {
  if (!(wsConnQueue && wsConnQueue[connId] && workerUtil.isFunction(wsConnQueue[connId].sendMsgToUser))) {
    return Promise.reject(new PushError('find not user', 'FIND_NOT_CONN'))
  }
  return wsConnQueue[connId].sendMsgToUser(headers, body)
}
module.exports = restfulPushServerMiddleware
module.exports.sendMessageByConnId = sendMessageByConnId
