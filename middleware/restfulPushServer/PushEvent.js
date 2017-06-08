'use strict'
const wsConnQueue = require('./wsConnQueue.js')
const request = require('../../lib/request')
const workerUtil = require('ddv-worker/util')
const PushBaseEvent = require('./PushBaseEvent.js')
const apiModelProxy = require('./apiModelProxy.js')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
const crypto = require('crypto')
const querystring = require('querystring')
const url = require('url')
const PushError = require('./PushError')
const regular = /-/g

class PushEvent extends PushBaseEvent {
  constructor (ws, req, options, serverRpcEvent) {
    super(ws, req, options)
    // 如果队列没有这个对象就加入这个对象
    wsConnQueue[this.connId] = wsConnQueue[this.connId] || this
    this.setConfigInfo()
    this.pushEventInit()
    this.serverRpcEvent = serverRpcEvent
    // 触发连接
    this.serverRpcEvent.emitOnConn(this.gwcid)
  }
  pushEventInit () {
    this.ws.on('close', this.onWsConnQueueClose.bind(this))
    this.ws.on('close', () => this.serverRpcEvent.emitOnClose(this.gwcid))
    // 获取文件事件
    this.on('protocol::apimodelproxy', this.onApiModelProxy.bind(this))
    this.on(['push', 'ping', '/v1_0/init'], this.pushPingHeartbeat.bind(this))
    this.on(['push', 'close', '/v1_0/init'], this.pushClose.bind(this))
    this.on(['push', 'open', '/v1_0/init'], this.pushOpen.bind(this))
  }
  // 设置配置信息
  setConfigInfo () {
    // 解析url
    let urlObj = url.parse(this.options.rpcEvent.apiUrl)
    this.options.apiUrlOpt = Object.create(null)
    this.options.apiUrlOpt.protocol = urlObj.protocol
    this.options.apiUrlOpt.host = urlObj.hostname
    this.options.apiUrlOpt.port = urlObj.port
    urlObj = void 0
  }
  // 关闭推送
  pushClose (headers, body, res) {
    // 请求id
    var requestId
    // 头部信息
    var headersObj = Object.create(null)
    var headersString
    // 配置信息
    var opt = Object.create(null)
    // 地址信息
    var urlObj = url.parse(this.options.rpcEvent.apiUrl + this.options.rpcEvent.onRtmpBoxHeartbeat)
    // 是否是Buffer
    var isBuffer = res.headers.bodytype === 'buffer'
    var promise

    requestId = res.headers && (res.headers.request_id || res.headers.requestId || res.headers.requestid)
    // 全局链接id
    headersObj.gwcid = this.gwcid
    // 服务器唯一识别号
    headersObj.serverGuid = this.serverGuid
    headersString = querystring.stringify(headersObj)

    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on pushClose`, 'HAS_BEEN_CLOSED'))
      return
    }

    if (res.headers && requestId) {
      promise = ddvRowraw.stringifyPromise(
        {
          'request_id': requestId
        },
        (isBuffer ? Buffer.alloc(0) : ''),
        'PUSH/1.0 200 OK'
      )
      .then(raw => {
        this.send(raw)
        isBuffer = void 0
      })
      .catch(e => {
        logger.error(new PushError('error'))
      })
    } else {
      promise = Promise.resolve()
    }

    promise.then(() => {
      if (!this.isPushOpened) {
        return
      }
      this.isPushOpened = false

      opt.method = 'PUT'
      opt.path = urlObj.path || '/'
      opt.headers = Object.create(null)
      opt.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
      opt.headers['Content-Length'] = Buffer.byteLength(headersString, 'utf8')
      Object.assign(opt, this.options.apiUrlOpt)

      return request(opt)
      .then(({headers, statusCode, statusMessage, body}) => {
        if (statusCode >= 200 && statusCode < 300) {
          return {headers, body}
        } else {
          logger.error(statusCode)
          logger.error(statusMessage)
          logger.error(body.toString())
          return Promise.reject(new PushError(statusMessage, (statusMessage || '').toUpperCase()))
        }
      })
    })
  }
  // 打开推送
  pushOpen (headers, body, res) {
    var headersObj = Object.create(null)
    var statR = ''
    var rawR = ''
    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on pushOpen`, 'HAS_BEEN_CLOSED'))
      return
    }
    // 请求id
    headersObj.request_id = res.headers && (res.headers.request_id || res.headers.requestId || res.headers.requestid)
    // 全局链接id
    headersObj.gwcid = this.gwcid
    // 服务器唯一识别号
    headersObj.serverGuid = this.serverGuid
    // 判断当前是否使用buffer模式返回
    let isBuffer = this.bodytype === 'buffer' || (this.bodytype === 'auto' && res.headers.bodytype === 'buffer')

    if (!(res.headers && headersObj.request_id)) {
      logger.error(new PushError('requestId Not FOUND'))
      return
    }

    if (this.isPushOpening) {
      rawR = Buffer.alloc(0)
      return ddvRowraw.stringifyPromise(
        headersObj,
        (isBuffer ? Buffer.alloc(0) : ''),
        'PUSH/1.0 202 PUSH_OPENING'
      )
      .then(raw => this.send(raw))
      .catch(e => {
        logger.error('error:send data to client')
        logger.error(e)
      })
    }
    // 标记正在打开推送系统
    this.isPushOpening = true

    if (this.isPushOpened) {
      statR = 'PUSH/1.0 201 PUSH_BEEN_OPENED'
    } else {
      statR = 'PUSH/1.0 200 OK'

      this.pushTimeOnLine = workerUtil.time()
      // 判断并储存数据传输的方式
      if (res.headers.bodytype && ['string', 'buffer'].indexOf(res.headers.bodytype) > -1) {
        this.bodytype = res.headers.bodytype
      } else {
        // 使用自动模式
        this.bodytype = 'auto'
      }
    }
    // 如果是使用Buffer模式就强转Buffer
    rawR = isBuffer ? Buffer.alloc(0) : ''

    if (this.isPushOpened) {
      ddvRowraw.stringifyPromise(
        headersObj,
        rawR,
        statR
      )
      .then(raw => this.send(raw))
      .catch(e => {
        logger.error('error:send data to client')
        logger.error(e)
      })

      headersObj = statR = rawR = void 0
    } else {
      this.pushPing(headers, body, res)
      .then(res => {
        this.isPushOpened = true
        ddvRowraw.stringifyPromise(
          headersObj,
          rawR,
          statR
        )
        .then(raw => this.send(raw))
        .catch(e => {
          logger.error('error:send data to client')
          logger.error(e)
        })
        headersObj = statR = isBuffer = rawR = void 0
      })
      .catch(e => {
        // 发送到客户端，发送失败
        console.log(321321321231, e)
      })
    }
  }
  pushPing (headers, body, res) {
    var opt = Object.create(null)

    if (!this.pingDataOptSign) {
      this.getPingData(headers, body, res)
    }
    Object.assign(opt, this.pingDataOptSign)
    // 生成唯一请求id
    opt.request_id = workerUtil.createRequestId()
    // 获取onPushOpen地址
    opt.path = this.options.rpcEvent.onPushOpen

    return this.request(opt, (res.headers.bodytype === 'buffer' ? (Buffer.alloc(0)) : ''), 'PING /v1_0/sign PUSH/1.0')
    .then(res => {
      let pingDataHKey = Object.keys(this.pingDataH || [])

      pingDataHKey.forEach((key, index) => {
        let lowkey = key.toLowerCase().replace(regular, '_')

        if (typeof this.pingDataH[key] === 'number') {
          this.pingDataH[key] = this.pingDataH[key].toString()
        }

        if (typeof res.headers[lowkey] === 'number') {
          res.headers[lowkey] = res.headers[lowkey].toString()
        }

        if (res.headers[lowkey] === this.pingDataH[key]) {
          delete res.headers[lowkey]
        } else {
          logger.error(new PushError(`headers sign fail, ${key}, ${res.headers[lowkey]}, ${res.headers}`, 'HEADERS_SIGN_FAIL'))
          return false
        }
        lowkey = void 0
      })
      // 撮合发送协议 端口 主机 信息
      Object.assign(opt, this.options.apiUrlOpt)
      // 判断是否已经修改了发过去的请求id
      if (res.headers.request_id !== opt.request_id) {
        logger.error(new PushError('request_id sign fail', 'REQUEST_ID_SIGN_FAIL'))
        return Promise.reject(new PushError('request_id sign fail', 'REQUEST_ID_SIGN_FAIL'))
      } else if (res.headers.host !== opt.host) {
        logger.error(new PushError('host sign fail', 'HOST_SIGN_FAIL'))
        return Promise.reject(new PushError('host sign fail', 'HOST_SIGN_FAIL'))
      } else {
        // 请求php的头 空对象
        opt.headers = Object.create(null)
        // 撮合一下
        Object.assign(opt.headers, this.pingDataH)
        // host 首字母大写
        opt.headers.Host = opt.host
        // Authorization 首字母大写
        opt.headers.Authorization = res.headers.authorization
      }
      return request(opt, this.pingDataRaw)
      .then(({headers, statusCode, statusMessage, body}) => {
        // 判断发送请求是否正常
        if (statusCode >= 200 && statusCode < 300) {
          return {headers, body, res}
        } else {
          logger.error(statusCode)
          logger.error(statusMessage)
          logger.error(body.toString())
          return Promise.reject(new PushError(statusMessage, (statusMessage || '').toUpperCase()))
        }
      })
    })
  }
  getPingData (headers, body, res) {
    // 上线时间-是第一次连接push-open的时间戳
    this.pushTimeOnLine = this.pushTimeOnLine || workerUtil.time()
    // 构建发送php的参数对象
    this.pingData = Object.create(null)
    // 连接唯一识别gwcid
    this.pingData.gwcid = this.gwcid
    // 本推送服务器的 guid
    this.pingData.serverGuid = this.serverGuid
    // 长连接连接类型
    this.pingData.bodyType = res.headers.bodytype
    // 第一次上线时间
    this.pingData.timeOnline = this.pushTimeOnLine
    // 把参数序列化转为buffer缓存区数据
    this.pingDataRaw = Buffer.from(querystring.stringify(this.pingData), 'utf-8')
    // 计算得出发送php的数据的二进制md5的base64
    this.pingDataMd5Base64 = crypto.createHash('md5').update(this.pingDataRaw).digest('base64')
    // 通知php的基本头
    this.pingDataH = Object.create(null)
    // 内容md5
    this.pingDataH['Content-Md5'] = this.pingDataMd5Base64
    // 内容长度
    this.pingDataH['Content-Length'] = this.pingDataRaw.length
    // 以这个协议进行编码
    this.pingDataH['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    // 解析url
    let urlObj = url.parse(this.options.rpcEvent.apiUrl)
    // 构造请求对象
    this.pingDataOpt = Object.create(null)
    // 获取php-传输协议 http:/https:
    this.pingDataOpt.protocol = urlObj.protocol
    // 获取php-host主机
    this.pingDataOpt.host = urlObj.hostname
    // 获取php-端口
    this.pingDataOpt.port = urlObj.port
    // 这个对象用于发送前端，给前端签名
    this.pingDataOptSign = Object.create(null)
    // put 协议
    this.pingDataOptSign.method = 'PUT'
    // 头
    this.pingDataOptSign.headers = JSON.stringify(this.pingDataH)

    headers = res = body = void 0
  }
  // 打开推送ping
  pushPingHeartbeat (headers, body, res) {
    var requestId
    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on pushPingHeartbeat`, 'HAS_BEEN_CLOSED'))
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
      ((this.bodytype === 'buffer' || (this.bodytype === 'auto' && res.bodytype === 'buffer')) ? Buffer.alloc(0) : ''),
      'PUSH/1.0 200 OK'
    )
    .then(raw => this.send(raw))
    headers = body = res = void 0
  }
  // 代理访问api服务器
  onApiModelProxy (res) {
    var requestId, resBody
    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on onApiModelProxy`, 'HAS_BEEN_CLOSED'))
      return
    }
    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
    resBody = res.bodytype === 'buffer' ? Buffer.alloc(0) : ''
    // 试图请求
    apiModelProxy(res, this.options)
    // 有请求结果
    .then(({headers, statusCode, statusMessage, body}) => {
      if (Buffer.isBuffer(resBody)) {
        resBody = Buffer.concat([resBody, body])
      } else {
        resBody += body
      }
      body = void 0
      // 序列化流
      return ddvRowraw.stringifyPromise({
        'request_id': requestId,
        'headers': JSON.stringify(headers)
      }, resBody, `APIMODELPROXY/1.0 ${statusCode || '0'} ${statusMessage || 'Unknow Error'}`)
    })
    // 中途异常
    .catch(e => {
      // 序列化流
      return ddvRowraw.stringifyPromise({
        'request_id': requestId,
        'headers': '{}',
        'msg': e.message,
        'message': e.message
      }, resBody, `APIMODELPROXY/1.0 400 ${e.errorId || 'Unknow Error'}`)
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
    if (!this.isWsOpen()) {
      let e = new PushError(`${this.gwcid}Has been closed, on sendMsgToUser`, 'HAS_BEEN_CLOSED')
      e.errorId = 'HAS_BEEN_CLOSED'
      logger.error(e)
      return Promise.reject(e)
    }
    // 转换推送类型
    if (this.bodytype === 'buffer' && ((typeof body) === 'string')) {
      body = Buffer.from(body, 'utf-8')
    } else if (this.bodytype === 'string' && Buffer.isBuffer(body)) {
      body = body.toString('utf-8')
    }
    var pushPath = '/'
    if (headers && headers['push-path']) {
      pushPath = (headers['push-path'].charAt(0) === '/' ? '' : '/') + headers['push-path']
    }
    return ddvRowraw.stringifyPromise({}, body, `MESSAGE ${pushPath} PUSH/1.0`)
    .then(raw => this.send(raw))
    .catch(e => {
      return Promise.reject(new PushError('send to user fail', 'SEND_TO_USER_FAIL'))
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

module.exports = PushEvent
