'use strict'
const wsConnQueue = require('./wsConnQueue.js')
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
const WebSocket = require('ws')
const PushBaseEvent = require('./PushBaseEvent.js')
const apiModelProxy = require('./apiModelProxy.js')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
class PushEvent extends PushBaseEvent {
  constructor (options, ws, req) {
    super(options, ws, req)
    // 如果队列没有这个对象就加入这个对象
    wsConnQueue[this.connId] = wsConnQueue[this.connId] || this
    this.pushEventInit()
  }
  pushEventInit () {
    this.ws.on('close', this.onWsConnQueueClose.bind(this))
    // 获取文件事件
    this.on('protocol::push', this.onMessagePush.bind(this))
    // 获取文件事件
    this.on('protocol::apimodelproxy', this.onApiModelProxy.bind(this))
    this.on(['push', 'ping', '/v1_0/init'], this.pushPingHeartbeat.bind(this))
    this.on(['push', 'close', '/v1_0/init'], this.pushClose.bind(this))
    this.on(['push', 'open', '/v1_0/init'], this.pushOpen.bind(this))
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
  // 关闭推送
  pushClose (headers, body, res) {
    var requestId
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(new Error(`${this.gwcid}Has been closed, on pushClose`))
      return
    }
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
  }
  // 打开推送
  pushOpen (headers, body, res) {
    var requestId
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(new Error(`${this.gwcid}Has been closed, on pushOpen`))
      return
    }
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
  }
  // 打开推送ping
  pushPingHeartbeat (headers, body, res) {
    var requestId
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(new Error(`${this.gwcid}Has been closed, on pushPingHeartbeat`))
      return
    }
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }

    if (headers.bodytype && ['string', 'buffer'].indexOf(headers.bodytype) > -1) {
      this.bodytype = headers.bodytype
    } else {
      this.bodytype = 'auto'
    }

    ddvRowraw.stringifyPromise(
      {
        request_id: requestId
      },
      ((this.bodytype === 'buffer' || (this.bodytype === 'auto' && res.bodytype === 'buffer')) ? new Buffer(0) : ''),
      'PUSH/1.0 200 OK'
    )
    .then(raw => this.send(raw))
    headers = body = res = void 0
  }
  // 代理访问api服务器
  onApiModelProxy (res) {
    var requestId, body
    if (this.ws.readyState !== WebSocket.OPEN) {
      logger.error(new Error(`${this.gwcid}Has been closed, on onApiModelProxy`))
      return
    }
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
    body = res.bodytype === 'buffer' ? Buffer(0) : ''
    // 试图请求
    apiModelProxy(res, this.options)
    // 有请求结果
    .then(({headers, statusCode, statusMessage, data}) => {
      if (Buffer.isBuffer(body)) {
        body = Buffer.concat([body, data])
      } else {
        body += data
      }
      data = void 0
      // 序列化流
      return ddvRowraw.stringifyPromise({
        'request_id': requestId,
        'headers': JSON.stringify(headers)
      }, body, `APIMODELPROXY/1.0 ${statusCode || '0'} ${statusMessage || 'Unknow Error'}`)
    })
    // 中途异常
    .catch(e => {
      // 序列化流
      return ddvRowraw.stringifyPromise({
        'request_id': requestId,
        'headers': '{}',
        'msg': e.message,
        'message': e.message
      }, body, `APIMODELPROXY/1.0 400 ${e.errorId || 'Unknow Error'}`)
    })
    .then(raw => this.send(raw))
    // 发送异常回去还是有异常打印日志
    .catch(e => {
      logger.error(`[gwcid:${this.gwcid}]onApiModelProxy error`)
      logger.error(e)
    })
  }
  // 发送信息个用户，信息来源rpc
  sendMsgToUser (headers, body) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      let e = new Error(`${this.gwcid}Has been closed, on sendMsgToUser`)
      e.errorId = 'HAS_BEEN_CLOSED'
      logger.error(e)
      return Promise.reject(e)
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
  // 收到消息的时候
  onWsConnQueueClose () {
    if (wsConnQueue[this.connId]) {
      workerUtil.isFunction(wsConnQueue[this.connId].destroy) && wsConnQueue[this.connId].destroy()
      delete wsConnQueue[this.connId]
    }
  }
}
worker.sendMessageByConnId = sendMessageByConnId
function sendMessageByConnId (connId, type, headers, body) {
  if (!(type && type === 'restfulPushServer')) {
    let e = new Error('type error')
    e.errorId = 'TYPE_CONN'
    return Promise.reject(e)
  }
  if (!(wsConnQueue && wsConnQueue[connId] && workerUtil.isFunction(wsConnQueue[connId].sendMsgToUser))) {
    let e = new Error('find not user')
    e.errorId = 'FIND_NOT_CONN'
    return Promise.reject(e)
  }
  return wsConnQueue[connId].sendMsgToUser(headers, body)
}
module.exports = PushEvent
