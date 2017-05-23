'use strict'
const EventEmitter = require('events')
const workerUtil = require('ddv-worker/util')
const WebSocket = require('ws')
const ddvRowraw = require('ddv-rowraw')
const logger = require('./logger.js')
class MessageEventEmitter extends EventEmitter {
  constructor (req) {
    super()
    this.baseMessageInit(req)
  }
  baseMessageInit (gwcid) {
    this.gwcid = gwcid
    this.processRequest = Object.create(null)
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
}
module.exports = MessageEventEmitter
