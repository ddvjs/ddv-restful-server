'use strict'

const WebSocket = require('ws')
const logger = require('../../lib/logger.js')
const workerUtil = require('ddv-worker/util')
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
    this.wsTryNum = 0
    this.wsTrySum = 3
    this.wsTryLastTime = 0
    this.wsTryIntervalTime = 3 * 1000
  }
  clientWsEventInit (guid, options) {
    this.on('ws::message', this.onMessage.bind(this))
  }
  // 获取ws
  getWs () {
    var isConnWs = false
    if (this.ws) {
      if (this.isWsOpen()) {
        return Promise.resolve(this.ws)
      } else if (this.ws.readyState !== WebSocket.CONNECTING) {
        isConnWs = true
        try {
          // 强行关闭
          workerUtil.isFunction(this.ws.close) && this.ws.close()
        } catch (e) {}
      }
    } else {
      isConnWs = true
    }
    return this.getWsRun(isConnWs)
  }
  getWsRun (isConnWs) {
    return new Promise((resolve, reject) => {
      var waitCbState = true
      var removeListener = () => {
        // 解绑打开事件
        onOpen && this.removeListener('ws::open', onOpen)
        // 解绑错误事件
        onError && this.removeListener('ws::error', onError)
        // 解绑错误事件
        onError && this.removeListener('ws::close', onError)
        // 回收
        waitCbState = onError = onOpen = removeListener = void 0
      }
      var onOpen = () => {
        if (!waitCbState) { return }
        // 成功连接上
        logger.log('ws conn open success')
        // 清零尝试次数
        this.wsTryNum = 0
        // 解绑事件
        removeListener && removeListener()
        // 重新
        this.getWs().then(resolve, reject)
      }
      var onError = e => {
        if (!waitCbState) { return }
        // 连接失败
        logger.error('ws conn error')
        // 连接错误
        logger.error(e)
        // 解绑事件
        removeListener && removeListener()
        // 重试次数还没有超出限制就继续重试
        if (this.wsTryNum++ < this.wsTrySum) {
          this.getWs().then(resolve, reject)
        } else if (new Date() - this.wsTryLastTime > this.wsTryIntervalTime) {
          // 过一段时间可以继续重试
          this.wsTryNum = 1
          this.getWs().then(resolve, reject)
        } else {
          // 反馈失败
          reject(e)
        }
      }
      // 绑定事件
      this.once('ws::open', onOpen)
      // 绑定事件
      this.once('ws::error', onError)
      // 绑定事件
      this.once('ws::close', onError)
      if (isConnWs) {
        this.wsTryLastTime = new Date()
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

  // 发送数据
  send (raw, options) {
    // 获取ws长连接
    this.getWs()
    .then(ws => {
      // 以承诺方式发送
      return new Promise((resolve, reject) => {
        this.sendWs(raw, options, e => {
          e ? reject(e) : resolve()
        })
      })
    })
  }
  // 获取客户端地址
  getClientUrl () {
    if (this.url) {
      return Promise.resolve(this.url)
    }
    this.url = this.options.rpcDomainSuffix[0] || 'ws://127.0.0.1/v1_0/rpc'
    this.url = this.url.replace('{{$guid}}', this.guid || '')
    console.log('-客户端GUID：' + this.guid, this.url)
    return Promise.resolve(this.url)
  }
}
module.exports = ClientWs

