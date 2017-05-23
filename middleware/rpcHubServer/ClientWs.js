'use strict'

const WebSocket = require('ws')
const logger = require('../../lib/logger.js')
const MessageEventEmitter = require('../../lib/MessageEventEmitter.js')

class ClientWs extends MessageEventEmitter {
  constructor (guid, options) {
    super(guid)
    this.baseInit(guid, options)
    this.clientWsEventInit()
  }
  baseInit (guid, options) {
    this.guid = guid
    this.options = options
    this.processRequest = Object.create(null)
    this.ws = null
    this.url = null
  }
  clientWsEventInit (guid, options) {
    this.on('ws::message', this.onMessage.bind(this))
  }
  getWs () {
    var isConnWs = false
    if (this.ws) {
      if (this.isWsOpen()) {
        return Promise.resolve(this.ws)
      } else if (this.ws.readyState !== WebSocket.CONNECTING) {
        isConnWs = true
        try {
          // 强行关闭
          this.ws && this.ws.close && this.ws.close()
        } catch (e) {}
      }
    } else {
      isConnWs = true
    }
    return new Promise((resolve, reject) => {
      var waitCbState = true
      var onOpen = () => {
        logger.log('ws conn open success')
        onOpen && this.removeListener('ws::open', onOpen)
        onError && this.removeListener('ws::error', onError)
        waitCbState && this.getWs().then(resolve, reject)
        waitCbState = onError = onOpen = void 0
      }
      var onError = e => {
        logger.error('ws conn error')
        logger.error(e)
        onOpen && this.removeListener('ws::open', onOpen)
        onError && this.removeListener('ws::error', onError)
        waitCbState && reject(e)
        waitCbState = onError = onOpen = void 0
      }
      this.once('ws::open', onOpen)
      this.once('ws::error', onError)
      if (isConnWs) {
        // 获取ws地址
        this.getClientUrl()
        // 开始连接
        .then(url => {
          // 实例化客户端
          this.ws = new WebSocket(url)
          this.ws.on('open', (...args) => this.emit.apply(this, ['ws::open'].concat(args)))
          this.ws.on('close', (...args) => this.emit.apply(this, ['ws::close'].concat(args)))
          this.ws.on('error', (...args) => this.emit.apply(this, ['ws::error'].concat(args)))
          this.ws.on('message', (...args) => this.emit.apply(this, ['ws::message'].concat(args)))
        })
      }
    })
  }

  // 处理请求
  send (raw) {
    console.log('raw', raw)
    this.getWs().then(ws => {
      console.log(4424)
      ws.send(raw)
      console.log(444)
    })
  }
  getClientUrl () {
    if (this.url) {
      return Promise.resolve(this.url)
    }
    let url = this.options.rpcDomainSuffix[0] || 'ws://127.0.0.1/v1_0/rpc'
    url = url.replace('{{$guid}}', this.guid || '')
    console.log('-客户端GUID：' + this.guid, url)
    return Promise.resolve(url)
  }
}
module.exports = ClientWs

