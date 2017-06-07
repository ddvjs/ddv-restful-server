'use strict'
module.exports = serverRpcEvent
// const request = require('./request')
const workerUtil = require('ddv-worker/util')
const path = require('path')
const fs = require('fs')
const url = require('url')
const guidHexReg = /[a-f\d\-]{37}/i

function serverRpcEvent (options, readFileSystem, writeFileSystem) {
  return new ServerRpcEvent(options, readFileSystem, writeFileSystem)
}
class ServerRpcEvent {
  constructor (options, readFileSystem, writeFileSystem) {
    this.initOptions(options)
    this.initFileSystem(readFileSystem, writeFileSystem)
    this.checkLastClose()
    this.startEventRpcSend()
  }
  /**
   * 获取以及设置参数
   * @method initOptions
   * @param  {[type]}    options [description]
   * @return {[type]}            [description]
   */
  initOptions (options) {
    this.options = options
    this.modulo = options.modulo || 50
    this.gwcids = {}
    this.saveGwcidTimers = []
    this.saveGwcidListsIndexs = []
    this.saveTimeOut = 200
    let urlObj = url.parse(this.options.rpcEvent.apiUrl)
    // 缓存文件路径
    this.serverRpcEventCacheRoot = options.serverRpcEventCacheRoot

    if (!this.serverRpcEventCacheRoot) {
      this.serverRpcEventCacheRoot = path.join(options.appPath, './serverRpcEventCache/')
    }
    // 解析url
    this.options.apiUrlOpt = Object.create(null)
    this.options.apiUrlOpt.protocol = urlObj.protocol
    this.options.apiUrlOpt.host = urlObj.hostname
    this.options.apiUrlOpt.port = urlObj.port
    urlObj = void 0
  }
  /**
   * 检查是否有自定义读写文件方法
   * @method initFileSystem
   * @param  {[function]}       readFileSystem  [description]
   * @param  {[function]}       writeFileSystem [description]
   * @return {[type]}                       [description]
   */
  initFileSystem (readFileSystem, writeFileSystem) {
    workerUtil.isFunction(readFileSystem) && (this.readFileSystem = readFileSystem)
    workerUtil.isFunction(writeFileSystem) && (this.writeFileSystem = writeFileSystem)
  }
  /**
   * 发送推送事件给php
   * @method serverStartEventRpc
   * @return {[type]}                    [description]
   */
  startEventRpcSend () {
    var opts = Object.create(null)
    opts.path = this.options.onServerStart
    Object.assign(opts, this.options.apiUrlOpt)
    // request(opts)
  }
  /**
   * 检查最后一次的关闭是否正常关闭还是异常关闭
   * @method serverCheckLastClose
   * @return {[type]}             [description]
   */
  checkLastClose () {

  // this.emitOnCloseSendRpcEvent(gwcid, this.serverGuid)
  }
  /**
   * [emitOnConnSendRpcEvent 长连接打开，发送rpcEvent]
   * @method emitOnConnSendRpcEvent
   * @param  {[type]}               gwcid      [description]
   * @param  {[type]}               serverGuid [description]
   * @return {[type]}                          [description]
   */
  emitOnConnSendRpcEvent (gwcid, serverGuid) {
    serverGuid = serverGuid || this.serverGuid
    /*

    // onConn推送给php
    pushEventRpcSend () {
      console.log(this.gwcid)
      var headersObj = Object.create(null)
      var headersString
      var opts = Object.create(null)
      opts.method = 'PUT'
      opts.path = this.options.rpcEvent.onConn
      Object.assign(opts, this.options.apiUrlOpt)
      // 全局链接id
      headersObj.gwcid = this.gwcid
      // 服务器唯一识别号
      headersObj.serverGuid = this.serverGuid
      headersString = querystring.stringify(headersObj)
      opts.headers = Object.create(null)
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
      opts.headers['Content-Length'] = Buffer.byteLength(headersString, 'utf8')

      this.
      return request(opts)
      .then(({}))
    }

     */
  }
  /**
   * [emitOnConn 触发onConn]
   * @method emitOnConn
   * @param  string   connId         [连接id]
   * @param  string   workerId       [description]
   * @param  string   serverGuid     [description]
   * @param  string   gwcidTimeStamp [description]
   */
  emitOnConn (gwcid, serverGuid) {
    this.addGwcid(gwcid)
    this.emitOnConnSendRpcEvent(gwcid, serverGuid)
  }
  /**
   * 触发onClose
   * @method emitOnClose
   * @return {[type]}    [description]
   */
  emitOnClose (gwcid, serverGuid) {
    this.removeGwcid(gwcid)
    this.emitOnCloseSendRpcEvent(gwcid, serverGuid)
  }
  /**
   * [emitOnCloseSendRpcEvent 长连接关闭，发送rpcEvent]
   * @method emitOnCloseSendRpcEvent
   * @param  {[type]}                gwcid      [description]
   * @param  {[type]}                serverGuid [description]
   * @return {[type]}                           [description]
   */
  emitOnCloseSendRpcEvent (gwcid, serverGuid) {
    serverGuid = serverGuid || this.serverGuid
  }
  saveGwcidLists (index, isSave) {
    var indexs
    Array.isArray(this.saveGwcidTimers) && this.saveGwcidTimers.forEach(timer => clearTimeout(timer))
    if (index !== void 0 && isSave !== true) {
      this.saveGwcidListsIndexs.indexOf(index) > -1 || this.saveGwcidListsIndexs.push(index)
      this.saveGwcidTimers.push(setTimeout(() => this.saveGwcidLists(index, true), this.saveTimeOut))
      return
    }
    indexs = (this.saveGwcidListsIndexs.length > 0) ? this.saveGwcidListsIndexs : Object.keys(this.gwcids)
    this.saveGwcidListsIndexs = []
    Array.isArray(indexs) && indexs.forEach(index => this.saveGwcidListsByIndex(index))
  }
  saveGwcidListsByIndex (index) {
    console.log('saveGwcidListsByIndex', this.gwcids, index, this.gwcids[index])
  }
  removeGwcid (gwcid) {
    var index, i
    index = getIndexByGwcid(gwcid)
    if (Array.isArray(this.gwcids[index])) {
      i = -1
      while ((i = this.gwcids[index].indexOf(gwcid)) > -1) {
        this.gwcids[index].splice(i, 1)
      }
    }
    this.saveGwcidLists(index)
  }
  addGwcid (gwcid) {
    var index = getIndexByGwcid(gwcid)
    if (!Array.isArray(this.gwcids[index])) {
      this.gwcids[index] = []
    }
    this.gwcids[index].push(gwcid)
    this.saveGwcidLists(index)
  }
  /**
   * 读取文件
   * @method readFileSystem
   * @param  {[string]}       relativePath [description]
   * @return {[function]}                    [description]
   */
  readFileSystem (relativePath) {
    return new Promise((resolve, reject) => {
      var filePath = path.resolve(this.serverRpcEventCacheRoot, relativePath)
      // 不编码，只读不写
      fs.readFile(filePath, {encoding: null, flag: 'r'}, (err, buffer) => {
        err ? reject(err) : resolve(buffer)
      })
    })
  }
  /**
   * 写入文件
   * @method writeFileSystem
   * @param  {[string]}        relativePath [description]
   * @param  {[object]}        buffer       [description]
   * @return {[function]}                     [description]
   */
  writeFileSystem (relativePath, buffer) {
    return new Promise((resolve, reject) => {
      var filePath = path.resolve(this.serverRpcEventCacheRoot, relativePath)
      // 不编码，只写不读
      fs.writeFile(filePath, buffer, {encoding: null, flag: 'w'}, err => {
        err ? reject(err) : resolve()
      })
    })
  }
}

serverRpcEvent.ServerRpcEvent = ServerRpcEvent
serverRpcEvent.getIndexByGwcid = getIndexByGwcid

function getIndexByGwcid (gwcid, modulo) {
  var wcid, index
  if (typeof gwcid !== 'string') {
    gwcid = gwcid.toString()
  }
  wcid = gwcid.replace(guidHexReg, '') || ''
  wcid = wcid.split('-').slice(0, 2).join('')
  index = parseInt(wcid, 36) % (parseInt(modulo) || 50)
  return index
}
