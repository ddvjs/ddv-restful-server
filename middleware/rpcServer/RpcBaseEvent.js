'use strict'
const RpcError = require('./RpcError.js')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
const MessageEventEmitter = require('../../lib/MessageEventEmitter.js')
class RpcBaseEvent extends MessageEventEmitter {
  constructor (options, ws, req) {
    super(req.gwcid || ws.gwcid)
    this.baseInit(options, ws, req)
    this.wsEventBaseInit()
  }
  baseInit (options, ws, req) {
    this.options = options
    this.ws = ws
    this.req = req
    this.connId = req.connId || ws.connId
    this.connTime = req.connTime
    this.workerId = req.workerId
    this.serverGuid = req.serverGuid
    this.gwcidTimeStamp = req.gwcidTimeStamp
    this.gwcidTimeStampStr = this.gwcidTimeStamp.toString()
  }
  // 初始化
  wsEventBaseInit () {
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
    // 获取文件事件
    this.on('protocol::rpc', this.onMessageRpc.bind(this))
    // 获取文件事件
    this.on(['rpc', 'call'], this.onMessageRpcCall.bind(this))
  }
  onClose (e) {}
  // 推送类型的信息
  onMessageRpc (res) {
    if (!(res.method && res.path && this.emit(['rpc', res.method.toLowerCase()], res.headers, res.body, res))) {
      logger.error(`[gwcid:${this.gwcid}]onMessageRpc error`)
      this.send(`Rpc request not found, not find method:${res.method}`)
      .catch(e => {
        logger.error(e)
      })
    }
  }
  onMessageRpcCall (headers, body, res) {
    this.onMessageRpcCallRun(headers, body, res)
    .then(res => {
      return ddvRowraw.stringifyPromise({
        request_id: headers.request_id
      }, JSON.stringify('body'), `RPC/1.0 200 OK`)
    })
    .catch(e => {
      console.log(e)
      return ddvRowraw.stringifyPromise({
        request_id: headers.request_id
      }, JSON.stringify('body'), `RPC/1.0 500 ${e.message}`)
    })
    .then(raw => this.send(raw))
  }
  onMessageRpcCallRun (headers, body, {path}) {
    var wcids

    if (typeof headers !== 'object') {
      return Promise.reject(new RpcError('Data is illegal, data is not a valid object', 'DATA_VALID_OBJECT'))
    }

    if (headers.guid !== this.serverGuid) {
      return Promise.reject(new RpcError('Rpc serverGuid and call serverGuid inconsistent', 'SERVER_GUID_ERROR'))
    }

    if (headers.time_stamp !== this.gwcidTimeStampStr) {
      return Promise.reject(new RpcError('Rpc gwcidTimeStamp and call gwcidTimeStamp inconsistent', 'GWCID_TIMESTAMP_ERROR'))
    }

    try {
      wcids = JSON.parse(headers.wcids)
    } catch (e) {
      e.errorId = 'WCIDS_PARSE_ERROR'
      return Promise.reject(e)
    }
    if (!Array.isArray(wcids)) {
      return Promise.reject(new RpcError('Wcids must be an array', 'WCIDS_MUST_BE_AN_ARRAY'))
    }
    if (wcids.length < 0) {
      return Promise.reject(new RpcError('Rpc gwcidTimeStamp and call gwcidTimeStamp inconsistent', 'GWCID_TIMESTAMP_ERROR'))
    }
    wcids = this._wcidGroupParse(wcids)

    try {
      headers.headers = JSON.parse(headers.headers)
    } catch (e) {
      headers.headers = {}
    }
    return this.rpcCall(path, wcids, headers.headers, body)
  }
  _wcidGroupParse (wcids) {
    var wcidsObj = Object.create(null)
    let wcidsArray = wcids || []
    wcidsArray.forEach(item => {
      var temp = item.split('-')

      if (wcidsObj[temp[0]] && Array.isArray(wcidsObj[temp[0]])) {
        wcidsObj[temp[0]].push(temp[1])
      } else {
        wcidsObj[temp[0]] = [temp[1]]
      }
    })
    wcidsArray = void 0
    return wcidsObj
  }
  ping (res) {
    var r
    r = Object.create(null)
    r.type = 'pong'
    r.sign = '3232321'
    r.data = {}
    // 验证通信密码
    if (res.sign === '123123123') {
      r.data.state = true
      r.data.error_id = 'OK'
    } else {
      r.data.state = false
      r.data.error_id = 'sign_error'
    }

    this.send(JSON.stringify(r), function (e) {
      logger.log(`回应rpc-ws-client签名: ${e}`)
    })
  }
  // 关闭ws
  close () {
    return new Promise((resolve, reject) => {
      this.ws.close.apply(this.ws, arguments)
      resolve()
    })
  }
  // 发送
  send (data, options) {
    return new Promise((resolve, reject) => {
      return this.sendWs(data, options, e => {
        e ? reject(e) : resolve()
      })
    })
  }
  // 发送ws
  sendWs () {
    return this.ws.send.apply(this.ws, arguments)
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
module.exports = RpcBaseEvent
