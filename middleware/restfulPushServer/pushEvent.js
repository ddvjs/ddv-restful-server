'use strict'
const EventEmitter = require('events')
const wsConnQueue = require('./wsConnQueue.js')
const workerUtil = require('ddv-worker/util')
module.exports = class PushEvent extends EventEmitter {
  constructor (options, ws, req) {
    super()
    this.options = options
    this.ws = ws
    this.req = req
    this.requestId = req.requestId || ws.requestId
    console.log('32', this.requestId, req.gwcid)
    this.wsEventInit()
    // 如果队列没有这个对象就加入这个对象
    wsConnQueue[this.requestId] = wsConnQueue[this.requestId] || this
  }
  // 初始化
  wsEventInit () {
    this.ws.on('message', this.onMessage.bind(this))
    this.ws.on('close', this.onClose.bind(this))
  }
  // 发送
  sendWs () {
    return this.ws.send.apply(this.ws, arguments)
  }
  // 关闭
  closeWs () {
    return this.ws.close.apply(this.ws, arguments)
  }
  // 收到消息的时候
  onClose () {
    if (wsConnQueue[this.requestId]) {
      workerUtil.isFunction(wsConnQueue[this.requestId].destroy) && wsConnQueue[this.requestId].destroy()
      delete wsConnQueue[this.requestId]
    }
  }
  // 收到消息的时候
  onMessage (msg) {
    console.log('msg', msg)
    var len = Object.keys(wsConnQueue).length
    Object.keys(wsConnQueue).forEach(requestId => {
      console.log(requestId)
      wsConnQueue[requestId].sendWs(`${len}在线`)
      wsConnQueue[requestId].sendWs(`${requestId}说:${msg}`)
    })
  }
  // 销毁
  destroy () {
    process.nextTick(() => {
      var key
      for (key in this) {
        if (!this.hasOwnProperty(key)) continue
        delete this[key]
      }
      key = void 0
    })
  }
}
