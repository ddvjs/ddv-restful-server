'use strict'
const logger = require('../../lib/logger.js')
const MessageEventEmitter = require('../../lib/MessageEventEmitter.js')
class PushBaseEvent extends MessageEventEmitter {
  constructor (options, ws, req) {
    super(req)
    this.baseInit(options, ws, req)
    this.wsEventBaseInit()
  }
  // 初始化
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
    // 获取文件事件
    this.on('protocol::push', this.onMessagePush.bind(this))
  }
  // 推送类型的信息
  onMessagePush (res) {
    if (!(res.method && res.path && this.emit(['push', res.method.toLowerCase(), res.path], res.headers, res.body, res))) {
      logger.error(`[gwcid:${this.gwcid}]onMessagePush error`)
      this.send(`Push request not found, not find method:${res.method}`)
      .catch(e => {
        logger.error(e)
      })
    }
  }
  // 收到消息的时候
  onClose () {

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
module.exports = PushBaseEvent
