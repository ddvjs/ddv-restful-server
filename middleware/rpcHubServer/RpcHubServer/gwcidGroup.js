'use strict'
module.exports = gwcidGroup
const guidReg = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/
const workerIdReg = /^\d+$/
const connIdReg = /^[\da-z]+$/
const timeStampReg = /^\d+$/
const RpcHubError = require('../RpcHubError')

function gwcidGroup (gwcidsInput) {
  var gwcids = []
  var gwcidsError = []
  if (typeof gwcidsInput === 'string') {
    gwcidsInput = gwcidsInput.split(',')
  }
  if (!Array.isArray(gwcidsInput)) {
    return Promise.reject(new RpcHubError('gwcids not is array', 'GWCIDS_NOT_IS_ARRAY'))
  }
  gwcidsInput.forEach(gwcid => {
    var gwcidOld, guid, wcid, workerId, connId, timeStamp
    if (!gwcid) {
      return
    }
    gwcidOld = gwcid
    gwcid = gwcid.trim()
    if (!gwcid) {
      gwcidsError.push(gwcidOld)
      return
    }
    // 切割gwcid前36位字符获得rpc服务器(也就是客户端所连接的服务器)的guid(唯一标识)
    guid = gwcid.substr(0, 36)

    // guid不合法
    if (!guidReg.test(guid)) {
      gwcidsError.push(gwcidOld)
      return
    }
    // 线程id & 客户端连接id & 时间戳 组成的数组
    wcid = (gwcid.substr(37) || '').toString().split('-')
    // guid不合法
    if (wcid.length < 3) {
      gwcidsError.push(gwcidOld)
      return
    }

    // 将 线程id & 客户端连接id & 时间戳 分别存到变量中
    workerId = wcid[0] || ''
    connId = wcid[1] || ''
    timeStamp = wcid[2] || ''
    // 线程id & 客户端连接id & 时间戳 任何一个为空字符串时, 向错误队列加入一个错误, 并结束
    if ((!workerId) || (!connId) || (!timeStamp)) {
      gwcidsError.push(gwcidOld)
      return
    }
    // 线程id & 客户端连接id & 时间戳 任何一个不合法时, 向错误队列加入一个错误, 并结束
    if ((!workerIdReg.test(workerId)) || (!connIdReg.test(connId)) || (!timeStampReg.test(timeStamp))) {
      gwcidsError.push(gwcid)
      return
    }
    // gwcids(等同于"bodyData.gwcids"), 在gwcids下以rpc的guid为键名建立一个对象
    gwcids[guid] = gwcids[guid] || Object.create(null)

    // 在gwcids下某一个rpc对象中添加一个属性, 该属性以时间戳命名, 类型是数组, 用于存储这个时间戳下的线程id和连接id
    gwcids[guid][timeStamp] = gwcids[guid][timeStamp] || []
    gwcids[guid][timeStamp].push(workerId + '-' + connId)
    // 释放内存
    gwcidOld = guid = wcid = workerId = connId = timeStamp = void 0
  })
  return Promise.resolve({gwcids, gwcidsError})
}
