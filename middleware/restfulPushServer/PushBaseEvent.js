'use strict'
const logger = require('../../lib/logger.js')
const MessageEventEmitter = require('../../lib/MessageEventEmitter.js')
const PushError = require('./PushError')
class PushBaseEvent extends MessageEventEmitter {
  constructor (ws, req, options) {
    super(req.gwcid)
    this.baseInit(ws, req, options)
    this.wsEventBaseInit()
  }
  // 初始化
  baseInit (ws, req, options) {
    this.options = options
    this.ws = ws
    this.req = req
    this.connId = req.connId || ws.connId
    this.connTime = req.connTime
    this.workerId = req.workerId
    this.serverGuid = req.serverGuid
    this.gwcidTimeStamp = req.gwcidTimeStamp
  }
  // 初始化
  wsEventBaseInit () {
    this.ws.on('message', this.onMessage.bind(this))
    // 获取文件事件
    this.on('protocol::push', this.onMessagePush.bind(this))
  }
  // 推送类型的信息
  onMessagePush (res) {
    if (!this.isConstructored) {
      return false
    }
    if (!(res.method && res.path && this.emit(['push', res.method.toLowerCase(), res.path], res.headers, res.body, res))) {
      logger.error(`[gwcid:${this.gwcid}]onMessagePush error`)
      this.send(`Push request not found, not find method:${res.method}`)
      .catch(e => {
        logger.error(e)
      })
    }
  }
  // 关闭ws
  close () {
    if (!this.isConstructored) {
      return Promise.reject(new PushError('Has been destroyed', 'HAS_BEEN_DESTROYED'))
    }
    return new Promise((resolve, reject) => {
      this.ws.close.apply(this.ws, arguments)
      resolve()
    })
  }
  // 发送
  send (data, options) {
    if (!this.isConstructored) {
      return Promise.reject(new PushError('Has been destroyed', 'HAS_BEEN_DESTROYED'))
    }
    return new Promise((resolve, reject) => {
      return this.sendWs(data, options, e => {
        e ? reject(e) : resolve()
      })
    })
  }
  // 发送ws
  sendWs () {
    if (!this.isConstructored) {
      return false
    }
    return this.ws.send.apply(this.ws, arguments)
  }
  // 销毁
  destroy () {
    if (!this.isConstructored) {
      return false
    }
    this.close()
    .catch(e => {
      logger.error(`[gwcid:${this.gwcid}] Failed to close at the time of destroy`)
    })
    .then(() => {
      super.destroy()
    })
  }
}
module.exports = PushBaseEvent
