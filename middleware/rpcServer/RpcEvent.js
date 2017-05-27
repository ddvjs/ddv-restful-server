'use strict'

const rpcCallProcessCallback = require('./rpcCallProcessCallback.js')
const RpcBaseEvent = require('./RpcBaseEvent.js')
// const ddvRowraw = require('ddv-rowraw')
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')

class RpcEvent extends RpcBaseEvent {
  constructor (options, rpcCall, ws, req) {
    super(options, ws, req)
    this.rpcCallInit(rpcCall)
  }
  rpcCallInit (rpcCall) {
    this.rpcCall = rpcCall
  }
  rpcCall (path, wcids, headers, body) {
    var callRes = Object.create(null)
    var calls = []
    var workerIds = Object.keys(wcids) || []
    // 因为ipc进程通讯不能传送 Buffer , 因此需要把
    var bodyBase64 = workerIds.length > 0 && Buffer.isBuffer(body) ? body.toString('base64') : ''
    workerIds.forEach(workerId => {
      let cids = wcids[workerId] || []
      if (!(Array.isArray(cids) && cids.length > 0)) {
        return
      }
      calls.push(sendToWorker(workerId, {
        cids,
        path,
        headers,
        bodyBase64
      }))
    })
    return Promise.all(calls)
    .then(callRess => {
      callRes.error = Array.isArray(callRes.error) ? callRes.error : []
      callRes.success = Array.isArray(callRes.success) ? callRes.success : []
      // 遍历每个进程的结果
      Array.isArray(callRess) && callRess.forEach(callResTiem => {
        if (!callResTiem) { return }
        // 合并成功结果
        Array.isArray(callResTiem.success) && callRes.success.push.apply(callRes.success, callResTiem.success)
        // 合并失败结果
        Array.isArray(callResTiem.error) && callRes.error.push.apply(callRes.error, callResTiem.error)
      })
      console.log('all-callRes', callRes)
      // 返回结果
      return callRes
    })
  }
}
module.exports = RpcEvent

function sendToWorker (workerId, message) {
  var id = workerUtil.createNewPid()
  return new Promise(function (resolve, reject) {
    rpcCallProcessCallback[id] = [resolve, reject]
    worker.sendToWorker(workerId, 'rpcCall', {id, message})
    .catch(e => console.log(e) || Promise.reject(e))
    .catch(reject)
  })
  .then(res => {
    console.log(88, res)
    return res
  })
}

worker.on('worker::event::rpcCallCallback', function (res, handle, fromWorkerId, toWorkerId) {
  console.log('rpcCallCallback', res)
  res.id && rpcCallProcessCallback[res.id][0](res.res)
})
