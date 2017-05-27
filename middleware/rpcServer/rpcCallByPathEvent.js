'use strict'
const rpcCallByPathEvent = Object.create(null)
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
const logger = require('../../lib/logger.js')
// 返回一个纯粹的空对象
module.exports = rpcCallByPathEvent

worker.on('worker::event::rpcCall', function (res, handle, fromWorkerId, toWorkerId) {
  if (typeof res !== 'object') {
    return
  }
  onRpcCall(res.message)
  .then(callRes => {
    callRes.errorId = callRes.errorId || 'OK'
    callRes.message = callRes.message || ''
    worker.sendToWorker(fromWorkerId, 'rpcCallCallback', {id: res.id, data: callRes})
    .catch(e => logger.error(e))
  })
  .catch(e => {
    worker.sendToWorker(fromWorkerId, 'rpcCallCallback', {
      id: res.id,
      data: {
        message: e.message || 'rpc call fail rpcCall',
        errorId: e.errorId || 'RPC_CALL_FAIL_RPCCALL'
      }
    })
    .catch(e => logger.error(e))
  })
})
function onRpcCall (message) {
  var res = Object.create(null)
  res.fails = []
  res.success = []

  if (typeof message !== 'object') {
    return Promise.reject(new Error(''))
  }
  var {path, cids, headers, bodyBase64} = message
  path = path || '/'

  if (!Array.isArray(cids)) {
    return Promise.reject(new Error(''))
  }
  var body = Buffer.from(bodyBase64, 'base64')
  var run = []
  cids.forEach(connId => {
    if (workerUtil.isFunction(rpcCallByPathEvent[path])) {
      run.push(
        // 调用具体的处理
        rpcCallByPathEvent[path](connId, headers, body)
        // 成功的时候
        .then(body => res.success.push({
          wcid: `${worker.id}-${connId}`,
          message: '',
          errorId: 'OK',
          body: body
        }))
        // 失败的时候
        .catch(e => res.fails.push({
          wcid: `${worker.id}-${connId}`,
          message: e.message || 'rpc call fail onRpcCall',
          errorId: e.errorId || 'RPC_CALL_FAIL_ONCALL'
        })
      ))
    } else {
      res.fails.push({
        message: 'not find rpc call path',
        errorId: 'NOT_FIND_RPC_CALL_PATH'
      })
    }
  })

  return Promise.all(run)
  .then(() => {
    return Promise.resolve(res)
  })
}
