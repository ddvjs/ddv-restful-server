'use strict'
module.exports = serverRpcEvent
const request = require('./request')
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
  initOptions (options) {
    this.options = options
    this.serverRpcEventCacheRoot = options.serverRpcEventCacheRoot
    if ((!this.serverRpcEventCacheRoot) || (!4)) {
      this.serverRpcEventCacheRoot = path.join(options.appPath, './serverRpcEventCache/')
    }
  }
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
    request()
  }
  /**
   * 检查最后一次的关闭是否正常关闭还是异常关闭
   * @method serverCheckLastClose
   * @return {[type]}             [description]
   */
  checkLastClose () {
  }
  emitOnConn () {

  }
  emitOnClose () {

  }
  /**
   * 读取文件
   * @method readFileSystem
   * @param  {[type]}       relativePath [description]
   * @return {[type]}                    [description]
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
   * @param  {[type]}        relativePath [description]
   * @param  {[type]}        buffer       [description]
   * @return {[type]}                     [description]
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
