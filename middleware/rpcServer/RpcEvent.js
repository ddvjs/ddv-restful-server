'use strict'

const rpcCallProcessCallback = require('./rpcCallProcessCallback.js')
const RpcBaseEvent = require('./RpcBaseEvent.js')
// const ddvRowraw = require('ddv-rowraw')
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
const logger = require('../../lib/logger.js')
const RpcError = require('./RpcError.js')

class RpcEvent extends RpcBaseEvent {
  constructor (options, rpcCall, ws, req) {
    super(options, ws, req)
    this.rpcCallInit(rpcCall)
  }
  rpcCallInit (rpcCall) {
    if (rpcCall && workerUtil.isFunction(rpcCall)) {
      this.rpcCall = rpcCall
    }
  }
  rpcCall (path, wcids, headers, body) {
    var callRes = {success: [], fails: []}
    var {success, fails} = callRes
    var calls = []
    var workerIds = Object.keys(wcids) || []
    // 因为ipc进程通讯不能传送 Buffer , 因此需要把
    var bodyBase64 = workerIds.length > 0 && Buffer.isBuffer(body) ? body.toString('base64') : ''
    workerIds.forEach(workerId => {
      let cids = wcids[workerId] || []
      if (!(Array.isArray(cids) && cids.length > 0)) {
        return
      }
      calls.push(
        sendToWorker(workerId, {
          cids,
          path,
          headers,
          bodyBase64
        })
        .then(res => {
          success.push.apply(success, res.success || [])
          fails.push.apply(fails, res.fails || [])
        })
        .catch(e => {
          logger.error('sendToWorker Error')
          logger.error(e)
          cids.forEach(cid => {
            fails.push({
              wcid: `${workerId}-${cid}`,
              errorId: e.errorId || 'SENDTOWORKER_ERROR',
              message: e.message || 'sendToWorker Error'
            })
          })
        })
      )
    })
    return Promise.all(calls)
    .then(callRess => {
      success = fails = calls = workerIds = bodyBase64 = void 0
      // 返回结果
      return callRes
    })
  }
}
module.exports = RpcEvent

function sendToWorker (workerId, message) {
  var id = workerUtil.createNewPid()
  return new Promise(function (resolve, reject) {
    // 存储回调
    rpcCallProcessCallback[id] = [resolve, reject]
    // 发送信息到目标进程
    worker.sendToWorker(workerId, 'rpcCall', {id, message})
    .catch(e => {
      reject(e)
      delete rpcCallProcessCallback[id]
    })
  })
}

worker.on('worker::event::rpcCallCallback', function (res, handle, fromWorkerId, toWorkerId) {
  if (!(res.id && res.data && rpcCallProcessCallback[res.id] && rpcCallProcessCallback[res.id][0])) {
    logger.error('worker::event::rpcCallCallback-Error', res)
    return
  }
  var data = res.data
  if (data.errorId && data.errorId.toUpperCase() === 'OK') {
    rpcCallProcessCallback[res.id][0](data)
  } else {
    rpcCallProcessCallback[res.id][1](new RpcError(data.message, data.errorId))
  }
  data = res = handle = fromWorkerId = toWorkerId = void 0
})
