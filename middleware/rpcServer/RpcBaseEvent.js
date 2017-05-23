'use strict'
const EventEmitter = require('events')
const workerUtil = require('ddv-worker/util')
const WebSocket = require('ws')
const ddvRowraw = require('ddv-rowraw')
const RpcError = require('./RpcError.js')
const logger = require('../../lib/logger.js')
class RpcBaseEvent extends EventEmitter {
  constructor (options, ws, req) {
    super()
    this.baseInit(options, ws, req)
    this.wsEventBaseInit()
  }
  baseInit (options, ws, req) {
    this.processRequest = Object.create(null)
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

  // 收到消息的时候
  onMessage (body) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(`${this.gwcid}Has been closed, on onMessage`)
      return
    }
    ddvRowraw.parsePromise(body)
    .then(res => {
      if (res.type === 'request') {
        if (res.protocol) {
          if (!(res.protocol && this.emit(('protocol::' + res.protocol.toLowerCase()), res))) {
            return this.send(`not find protocol:${res.protocol || ''}`)
          }
        } else {
          return this.send('The server does not support this request for the time being')
        }
      } else if (res.type === 'response') {
        process.nextTick(() => {
          this.onMessageResponse(res)
        })
      } else {
        return this.send(`not find type: ${res.type}`)
      }
    })
    .catch(e => {
      logger.error(`[gwcid:${this.gwcid}]onMessage error`)
      logger.error(e)
    })
  }
  // 处理请求
  request (headers, body, start) {
    var requestId
    requestId = headers.request_id = headers.request_id || workerUtil.createRequestId()
    return ddvRowraw.stringifyPromise(headers, body, start)
    .then(raw => this.send(raw))
    .then(() => {
      headers = body = start = void 0
      this.processRequest = this.processRequest || Object.create(null)
      return new Promise((resolve, reject) => {
        this.processRequest[requestId] = [resolve, reject, new Date()]
        requestId = void 0
      })
    })
  }
  // 收到请求结果-处理响应
  onMessageResponse (res) {
    var requestId, code, e, t
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
    if (this.processRequest && (t = this.processRequest[requestId]) && t.length > 1) {
      // 删除进程
      delete this.processRequest[requestId]
      code = parseInt(res.status || 0) || 0
      if (code >= 200 && code < 300) {
        workerUtil.isFunction(t[0], 'function') && t[0](res)
      } else {
        e = new Error(res.statusText || 'unknown error')
        workerUtil.extend.call(e, e, res)
        workerUtil.isFunction(t[1], 'function') && t[1](e)
        e = undefined
      }
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
