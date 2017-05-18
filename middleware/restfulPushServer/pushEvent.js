'use strict'
const EventEmitter = require('events')
const wsConnQueue = require('./wsConnQueue.js')
const workerUtil = require('ddv-worker/util')
const WebSocket = require('ws')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
module.exports = class PushEvent extends EventEmitter {
  constructor (options, ws, req) {
    super()
    this.baseInit(options, ws, req)
    this.wsEventInit()
    this.pushEventInit()
  }
  // 初始化
  baseInit (options, ws, req) {
    this.processRequest = Object.create(null)
    this.options = options
    this.ws = ws
    this.req = req
    this.requestId = req.requestId || ws.requestId
    this.connTime = req.connTime
    this.workerId = req.workerId
    this.serverGuid = req.serverGuid
    this.gwcidTimeStamp = req.gwcidTimeStamp
    this.gwcid = req.gwcid
    // 如果队列没有这个对象就加入这个对象
    wsConnQueue[this.requestId] = wsConnQueue[this.requestId] || this
  }
  // 初始化
  wsEventInit () {
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
  }
  // 初始化
  pushEventInit () {
  // 获取文件事件
    this.on('protocol::push', this.onMessagePush.bind(this))
  }
  // 收到消息的时候
  onClose () {
    if (wsConnQueue[this.requestId]) {
      workerUtil.isFunction(wsConnQueue[this.requestId].destroy) && wsConnQueue[this.requestId].destroy()
      delete wsConnQueue[this.requestId]
    }
  }
  // 推送类型的信息
  onMessagePush (res) {
    if (!(res.method && res.path && this.emit(['push', res.method.toLowerCase(), res.path], res.headers, res.body, res))) {
      this.send(`Push request not found, not find method:${res.method}`)
      .catch(e => {
        logger.error(`[gwcid:${this.gwcid}]onMessagePush error`)
        logger.error(e)
      })
    }
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
        this.onMessageResponse(res)
      } else {
        return this.send(`not find type: ${res.type}`)
      }
    })
    .catch(e => {
      logger.error(`[gwcid:${this.gwcid}]onMessage error`)
      logger.error(e)
    })
  }

  // 收到请求结果-处理响应
  onMessageResponse (res) {
    var requestId, code, e, t
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
    if (this.processRequest && (t = this.processRequest[requestId]) && t.length === 2) {
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
        this.processRequest[requestId] = [resolve, reject]
        requestId = void 0
      })
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

  // 发送信息个用户，信息来源rpc
  sendMsgToUser (headers, body, cb) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(`${this.gwcid}Has been closed, on sendMsgToUser`)
      return
    }
    // 转换推送类型
    if (this.bodytype === 'buffer' && ((typeof body) === 'string')) {
      body = new Buffer(body, 'utf-8')
    } else if (this.bodytype === 'string' && Buffer.isBuffer(body)) {
      body = body.toString('utf-8')
    }
    headers['push-path'] = (headers['push-path'].charAt(0) === '/' ? '' : '/') + headers['push-path']
    return ddvRowraw.stringifyPromise({}, body, `MESSAGE ${headers['push-path']} PUSH/1.0`)
    .then(raw => this.send(raw))
    .catch(e => {
      let resError = new Error('send to user fail')
      resError.errorId = 'SEND_TO_USER_FAIL'
      return Promise.reject(resError)
    })
  }
}
