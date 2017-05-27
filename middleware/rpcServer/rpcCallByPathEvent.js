'use strict'
const rpcCallByPathEvent = Object.create(null)
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
// 返回一个纯粹的空对象
module.exports = rpcCallByPathEvent

worker.on('worker::event::rpcCall', function (res, handle, fromWorkerId, toWorkerId) {
  if (typeof res !== 'object') {
    return
  }
  onRpcCall(res.message)
  .then(callRes => {
    worker.sendToWorker(fromWorkerId, 'rpcCallCallback', {id: res.id, res: callRes})
  })
  .catch(e => console.log('onRpcCall', e))
})
function onRpcCall (message) {
  var res = Object.create(null)
  res.error = []
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
        .then(resT => res.success.push(resT))
        // 失败的时候
        .catch(e => res.error.push({
          state: false,
          message: e.message || 'rpc call fail onRpcCall',
          errorId: e.errorId || 'RPC_CALL_FAIL_ONCALL'
        })
      ))
    } else {
      res.error.push({
        state: false,
        message: 'not find rpc call path',
        errorId: 'NOT_FIND_RPC_CALL_PATH'
      })
    }
  })

  return Promise.all(run)
  .then(() => {
    console.log('wwwwww', res)
    return Promise.resolve(res)
  })
}
