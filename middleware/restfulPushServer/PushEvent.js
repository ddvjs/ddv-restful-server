'use strict'
const wsConnQueue = require('./wsConnQueue.js')
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
const PushBaseEvent = require('./PushBaseEvent.js')
const apiModelProxy = require('./apiModelProxy.js')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
const crypto = require('crypto')
const querystring = require('querystring')
const url = require('url')
const http = require('http')
const https = require('https')
const PushError = require('./PushError')
const regular = /\-/g

class PushEvent extends PushBaseEvent {
  constructor (options, ws, req) {
    super(options, ws, req)
    // 如果队列没有这个对象就加入这个对象
    wsConnQueue[this.connId] = wsConnQueue[this.connId] || this
    this.setConfigInfo()
    this.pushEventInit()
  }
  pushEventInit () {
    this.ws.on('close', this.onWsConnQueueClose.bind(this))
    // 获取文件事件
    this.on('protocol::apimodelproxy', this.onApiModelProxy.bind(this))
    this.on(['push', 'ping', '/v1_0/init'], this.pushPingHeartbeat.bind(this))
    this.on(['push', 'close', '/v1_0/init'], this.pushClose.bind(this))
    this.on(['push', 'open', '/v1_0/init'], this.pushOpen.bind(this))
  }
  // 设置配置信息
  setConfigInfo () {
    // 解析url
    let urlObj = url.parse(this.options.rpcEvent.api_url)
    this.options.apiUrlOpt = Object.create(null)
    this.options.apiUrlOpt.protocol = urlObj.protocol
    this.options.apiUrlOpt.host = urlObj.hostname
    this.options.apiUrlOpt.port = urlObj.port
  }
  // 关闭推送
  pushClose (headers, body, res) {
    var requestId
    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on pushClose`, 'HAS_BEEN_CLOSED'))
      return
    }

    if (!(res.headers && (requestId = res.headers.request_id || res.headers.requestId || res.headers.requestid))) {
      return
    }
    console.log(requestId)
  }
  // 打开推送
  pushOpen (headers, body, res) {
    var headersObj = Object.create(null)
    var statR
    var rawR

    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on pushOpen`, 'HAS_BEEN_CLOSED'))
      return
    }
    // 请求id
    headersObj.requestId = res.headers && (res.headers.request_id || res.headers.requestId || res.headers.requestid)
    // 全局链接id
    headersObj.gwcid = this.gwcid
    // 服务器唯一识别号
    headersObj.serverGuid = this.serverGuid
    // 判断当前是否使用buffer模式返回
    let isBuffer = this.bodytype === 'buffer' || (this.bodytype === 'auto' && res.headers.bodytype === 'buffer')

    if (!(res.headers && headersObj.requestId)) {
      logger.error(new PushError('requestId Not FOUND'))
      return
    }

    if (this.isPushOpening) {
      rawR = new Buffer(0)
      ddvRowraw.stringifyPromise(
        {
          request_id: headersObj.requestId
        },
        (isBuffer ? new Buffer(0) : ''),
        'PUSH/1.0 202 PUSH_OPENING'
      )
      .then(raw => {
        console.log(123123131)
        this.send(raw)
      })
      .catch(e => {
        this.pushPing(headers, body, res)
        .then((res) => {
          console.log('签名结束', res)
        })
        .catch(e => {
          console.log('签名失败', e)
        })
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
      if (headers.bodytype && ['string', 'buffer'].indexOf(headers.bodytype) > -1) {
        this.bodytype = headers.bodytype
      } else {
        // 使用自动模式
        this.bodytype = 'auto'
      }
    }
    // 如果是使用Buffer模式就强转Buffer
    if (isBuffer) {
      rawR = new Buffer(0)
    }
  }
  pushPing (headers, body, res) {
    var opt = Object.create(null)
    var bodyObj, req

    if (!this.pingDataOptSign) {
      this.getPingData(headers, body, res)
    }
    Object.assign(opt, this.pingDataOptSign)
    // 生成唯一请求id
    opt.request_id = workerUtil.createRequestId()
    // 获取onOpen地址
    opt.path = this.options.rpcEvent.on_open

    return this.request(opt, (res.headers.bodytype === 'buffer' ? (new Buffer(0)) : ''), 'PING /v1_0/sign PUSH/1.0')
    .then(res => {
      return new Promise((resolve, reject) => {
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
          reject(new PushError('request_id sign fail', 'REQUEST_ID_SIGN_FAIL'))
        } else if (res.headers.host !== opt.host) {
          logger.error(new PushError('host sign fail', 'HOST_SIGN_FAIL'))
          reject(new PushError('host sign fail', 'HOST_SIGN_FAIL'))
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

        req = (opt.protocol === 'https:' ? https : http).request(opt, response => {
          bodyObj = new Buffer(0)
          // 接收数据
          response.on('data', (data) => {
            bodyObj = Buffer.concat([bodyObj, data])
            data = undefined
            // 接收结束
          }).on('end', function () {
            let obj = {
              headers,
              body,
              res
            }
            resolve(obj)
            console.log('签名结果', bodyObj.toString())
          })
        })
        // 写入发送的数据
        req.write(this.pingDataRaw)
        // 结束请求数据的发送
        req.end()
        req = undefined
      })
    })
    .catch(e => {
      logger.error('Signature failed')
      logger.error(e)
      return new Promise((resolve, reject) => {
        reject(new PushError('Signature failed', 'SIGNATURE_FAILED'))
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
    this.pingDataRaw = new Buffer(querystring.stringify(this.pingData), 'utf-8')
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
    let urlObj = url.parse(this.options.rpcEvent.api_url)
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
      ((this.bodytype === 'buffer' || (this.bodytype === 'auto' && res.bodytype === 'buffer')) ? new Buffer(0) : ''),
      'PUSH/1.0 200 OK'
    )
    .then(raw => this.send(raw))
    headers = body = res = void 0
  }
  // 代理访问api服务器
  onApiModelProxy (res) {
    var requestId, body
    if (!this.isWsOpen()) {
      logger.error(new PushError(`${this.gwcid}Has been closed, on onApiModelProxy`, 'HAS_BEEN_CLOSED'))
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
    if (!this.isWsOpen()) {
      let e = new PushError(`${this.gwcid}Has been closed, on sendMsgToUser`, 'HAS_BEEN_CLOSED')
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
worker.sendMessageByConnId = sendMessageByConnId
function sendMessageByConnId (connId, type, headers, body) {
  if (!(type && type === 'restfulPushServer')) {
    return Promise.reject(new PushError('type error', 'TYPE_CONN'))
  }
  if (!(wsConnQueue && wsConnQueue[connId] && workerUtil.isFunction(wsConnQueue[connId].sendMsgToUser))) {
    return Promise.reject(new PushError('find not user', 'FIND_NOT_CONN'))
  }
  return wsConnQueue[connId].sendMsgToUser(headers, body)
}
module.exports = PushEvent
