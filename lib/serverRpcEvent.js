'use strict'
module.exports = serverRpcEvent
// const request = require('./request')
const workerUtil = require('ddv-worker/util')
const path = require('path')
const fs = require('fs')

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
    // 缓存文件路径
    this.serverRpcEventCacheRoot = options.serverRpcEventCacheRoot

    if (!this.serverRpcEventCacheRoot) {
      this.serverRpcEventCacheRoot = path.join(options.appPath, './serverRpcEventCache/')
    }
  }
  /**
   * 检查是否有自定义读写文件方法
   * @method initFileSystem
   * @param  {[type]}       readFileSystem  [description]
   * @param  {[type]}       writeFileSystem [description]
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
    // request()
  }
  /**
   * 检查最后一次的关闭是否正常关闭还是异常关闭
   * @method serverCheckLastClose
   * @return {[type]}             [description]
   */
  checkLastClose () {

  }
  /**
   * 触发onConn
   * @method emitOnConn
   * @return {[type]}   [description]
   */
  emitOnConn () {

  }
  /**
   * 触发onClose
   * @method emitOnClose
   * @return {[type]}    [description]
   */
  emitOnClose () {

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
