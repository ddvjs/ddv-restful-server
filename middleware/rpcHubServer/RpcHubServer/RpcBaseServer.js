'use strict'
const EventEmitter = require('events')
const logger = require('../../../lib/logger.js')
const RpcHubError = require('../RpcHubError')
const gwcidGroup = require('./gwcidGroup.js')
class RpcBaseServer extends EventEmitter {
  constructor (options, req, res, next) {
    super()
    this.baseInit(options, req, res, next)
    this.rpcHeadersBaseInit()
    this.bodyDataListenerBaseInit()
  }
  // 初始化
  baseInit (options, req, res, next) {
    this.processRequest = Object.create(null)
    this.options = options
    this.req = req
    this.res = res
    this.next = next
    this.connId = req.connId
    this.connTime = req.connTime
    this.workerId = req.workerId
    this.serverGuid = req.serverGuid
    this.gwcidTimeStamp = req.gwcidTimeStamp
    this.gwcid = req.gwcid
    // 默认头
    this.xRpc = 'x-rpc-'.toString().replace(/-/g, '_')
  }
  // 初始化
  rpcHeadersBaseInit () {
    var xRpc, xRpcLen, rpcHeaders
    // rpc调用头
    rpcHeaders = Object.create(null)
    // 转字符串 转小写
    xRpc = this.xRpc
    // 计算长度
    xRpcLen = xRpc.length || 0
    // 获取rpc调用头
    for (let key in this.req.headers) {
      if (!Object.hasOwnProperty.call(this.req.headers, key)) {
        continue
      }
      let keyStr = key.toString()
      if (keyStr && keyStr.length > xRpcLen && xRpc === keyStr.substr(0, xRpcLen).replace(/-/g, '_')) {
        rpcHeaders[keyStr.substr(xRpcLen)] = this.req.headers[key]
      }
    }
    this.rpcHeaders = rpcHeaders
    xRpc = xRpcLen = rpcHeaders = void 0
  }
  // 初始化
  bodyDataListenerBaseInit () {
    var chunks
    // 默认 Buffer
    this.postBuffer = this.postBuffer || Buffer.from([])
    chunks = []
    // 接受请求数据
    this.req.addListener('data', chunkBuffer => {
      // 存储 Buffer
      chunks.push(chunkBuffer)
      chunkBuffer = void 0
    })
    // 接受完毕
    this.req.addListener('end', () => {
      // 拼接 Buffer
      this.postBuffer = Buffer.concat(chunks)
      chunks = void 0
      this.rpcHubBaseRun()
    })
  }
  // 初始化
  rpcHubBaseRun () {
    this.rpcCallBaseByRpcHeadersAndPath(this.req.path, this.rpcHeaders, this.postBuffer)
    .then(data => {
      data.statusCode = data.statusCode || 200
      data.errorId = (data.statusCode >= 200 && data.statusCode < 300) ? 'OK' : 'UNKNOWN_ERROR'
      return {
        statusCode: data.statusCode,
        statusMessage: data.errorId,
        body: JSON.stringify(data)
      }
    })
    .catch(e => {
      var data = {}
      data.statusCode = e.statusCode || 500
      data.errorId = e.errorId || e.message || 'Unknown Error'
      data.message = e.message || data.errorId || 'UNKNOWN_ERROR'
      return {
        statusCode: data.statusCode,
        statusMessage: data.errorId,
        body: JSON.stringify(data)
      }
    })
    .then(({statusCode, statusMessage, body}) => {
      // 输出头
      this.res.set({'Content-Type': 'application/json'})
      this.res.statusCode = statusCode || this.res.statusCode
      this.res.statusMessage = statusMessage || this.res.statusMessage

      // 写出数据
      this.res.write(body)
      // 结束
      this.res.end()
      statusCode = statusMessage = body = void 0
    })
  }
  // 初始化
  rpcCallBaseByRpcHeadersAndPath (path, rpcHeaders, postBuffer) {
    return this.getDataBaseByRpcHeadersAndPath(path, rpcHeaders, postBuffer)
    .then(data => {
      var res = this.rpcCallByDataBase(data)
      if (!data.isSync) {
        res
        .catch(e => console.log('syssf', e))
        .then(e => console.log('syssf', e))
        // 非同步模式先直接返回结果，其他结果通过回调方式返回
        res = Promise.resolve({success: [], error: [], id: data.id})
      }
      return res
    })
  }
  // 解析，获取信息
  getDataBaseByRpcHeadersAndPath (path, rpcHeaders, body) {
    var id, gwcids, isSync
    if (!(rpcHeaders && rpcHeaders.id)) {
      return Promise.reject(new RpcHubError('X-rpc-id header not found', 'X_RPC_ID_NOT_FIND'))
    }
    if ((!rpcHeaders.gwcid) && (!rpcHeaders.gwcids)) {
      // 结束操作
      return Promise.reject(new RpcHubError('X-rpc-gwcid header not found', 'X_RPC_GWCID_NOT_FIND'))
    }
    id = rpcHeaders.id
    gwcids = rpcHeaders.gwcid || rpcHeaders.gwcids
    isSync = false

    if (rpcHeaders.sync) {
      isSync = ['true', '1', 'yes'].indexOf(rpcHeaders.sync) > -1
    } else if (rpcHeaders.async) {
      isSync = ['true', '1', 'yes'].indexOf(rpcHeaders.async) < 0
    }

    delete rpcHeaders['id']
    delete rpcHeaders['sync']
    delete rpcHeaders['async']
    delete rpcHeaders['gwcid']
    delete rpcHeaders['gwcids']
    return Promise.resolve({id, gwcids, path, isSync, body, headers: rpcHeaders})
  }
  rpcCallByDataBase (data) {
    var resError = []
    // 获取gwcid组合数据
    return gwcidGroup(data.gwcids)
    // 处理错误格式的id
    .then(({gwcids, gwcidsError}) => {
      var calls = []
      gwcidsError.forEach(gwcid => {
        resError.push({'gwcid': gwcid, 'errorId': 'GWCID_FORMAT_ERROR'})
      })
      for (let guid in gwcids) {
        if (typeof gwcids[guid] !== 'object') {
          continue
        }
        let timeStampS = gwcids[guid]
        for (let timeStamp in timeStampS) {
          // 建立连接
          let res = this.rpcCall(data.id, guid, timeStampS[timeStamp], data.headers, data.body, data.path, timeStamp)
          calls.push(res)
          timeStamp = res = void 0
        }
        timeStampS = guid = void 0
      }
      return Promise.all(calls)
      .then(resArray => {
        var res = {success: [], error: []}
        Array.isArray(resArray) && resArray.forEach(t => {
          if (t) {
            Array.isArray(t.success) && res.success.push.apply(res.success, t.success)
            Array.isArray(t.error) && res.error.push.apply(res.error, t.error)
          }
        })
        return res
      })
    })
    .then(res => {
      res.error = Array.isArray(res.error) ? res.error : []
      res.error = res.error.concat(resError)
      return res
    })
  }
  // 销毁
  destroy () {
    this.close()
    .catch(e => {
      logger.error(`[gwcid:${this.gwcid}] Failed to close at the time of destroy`)
    })
    .then(() => {
      process.nextTick(() => {
        var key
        for (key in this) {
          if (!this.hasOwnProperty(key)) continue
          delete this[key]
        }
        key = void 0
      })
    })
  }
}
module.exports = RpcBaseServer
