'use strict'
const EventEmitter = require('events')
// const workerUtil = require('ddv-worker/util')
const WebSocket = require('ws')
// const ddvRowraw = require('ddv-rowraw')
const RpcError = require('./RpcError.js')
const logger = require('../../lib/logger.js')
class RpcBaseEvent extends EventEmitter {
  constructor (options, ws, req) {
    super()
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
    this.gwcid = req.gwcid
  }
  // 初始化
  wsEventBaseInit () {
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
  }
  isWsOpen () {
    return this.ws.readyState === WebSocket.OPEN
  }
  onMessage (message) {
    // 将消息转为对象
    var res
    try {
      res = JSON.parse(message.toString())
    } catch (e) {
      res = {}
    }

    switch ((res.type || '')) {
      // ping
      case 'ping':
        this.ping(res)
        break
      // 远程调用
      case 'rpc_call':
        this.rpcCallRun(res)
        .catch(e => {
          var sysError = Object.create(null)
          sysError.message = e.message || 'unknown error'
          sysError.errorId = e.errorId || 'UNKNOWN_ERROR'
          sysError.stack = e.stack
          return {sysError}
        })
        .then(res => {
          this.send(JSON.stringify(res))
        })
        break
      // 未知类型
      default:
        logger.log(`rpc收到未知信息: ${message}`)
    }
  }
  onClose (e) {}
  rpcCallRun (res) {
    var {wcids, path, body} = res.data

    if (typeof res.data !== 'object') {
      return Promise.reject(new RpcError('Data is illegal, data is not a valid object', 'DATA_VALID_OBJECT'))
    }

    if (res.data.guid !== this.serverGuid) {
      return Promise.reject(new RpcError('Rpc serverGuid and call serverGuid inconsistent', 'SERVER_GUID_ERROR'))
    }

    if (res.data.time_stamp !== this.gwcidTimeStamp) {
      return Promise.reject(new RpcError('Rpc gwcidTimeStamp and call gwcidTimeStamp inconsistent', 'GWCID_TIMESTAMP_ERROR'))
    }

    if ((typeof wcids === 'string' && wcids.length > 0) || typeof wcids === 'number') {
      wcids = wcids.toString()
    }

    if (wcids.length < 0) {
      return Promise.reject(new RpcError('Rpc gwcidTimeStamp and call gwcidTimeStamp inconsistent', 'GWCID_TIMESTAMP_ERROR'))
    }
    return this.rpcCall(path, wcids, body)
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
