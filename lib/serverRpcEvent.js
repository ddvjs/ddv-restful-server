'use strict'
module.exports = serverRpcEvent
const request = require('./request')
const worker = require('ddv-worker')
const workerUtil = require('ddv-worker/util')
const url = require('url')
const guidHexReg = /[a-f\d\-]{37}/i
const ServerRpcDriver = require('./serverRpcDriver.js')
const logger = require('./logger.js')

function serverRpcEvent (options, Driver) {
  // readFileSystem, writeFileSystem
  return new ServerRpcEvent(options, Driver || ServerRpcDriver)
}
class ServerRpcEvent {
  constructor (options, Driver) {
    this.initOptions(options)
    // 初始化驱动
    this.initDriver(Driver)
    .then(() => {
      // 检查上一次的关闭
      return this.checkLastClose()
    })
    .then(() => {
      return this.serialize({
        gwcidTimeStamp: worker.gwcidTimeStamp
      })
      .then(raw => this.driver.write(1, raw))
    })
    .then(() => {
      // 发送启动给服务器
      return this.onServerStartEventRpcSend()
    })
    .then(() => {
      logger.log('server rpc event start success')
    })
  }
  /**
   * 获取以及设置参数
   * @method initOptions
   * @param  {[type]}    options [description]
   * @return {[type]}            [description]
   */
  initOptions (options) {
    this.options = options
    // 分多少个文件存储gwcid，默认50
    this.modulo = options.modulo || 50
    // gwcid池
    this.gwcids = {}
    // 定时器句柄
    this.saveGwcidTimers = []
    // 等待保存的文件下标
    this.saveGwcidListsIndexs = []
    // 默认保存延时时间
    this.saveTimeOut = 200
    // 服务器guid
    this.serverGuid = worker.serverGuid
    let urlObj = url.parse(this.options.rpcEvent.apiUrl)
    // 解析url
    this.options.apiUrlOpt = Object.create(null)
    this.options.apiUrlOpt.protocol = urlObj.protocol
    this.options.apiUrlOpt.host = urlObj.hostname
    this.options.apiUrlOpt.port = urlObj.port
    urlObj = void 0
  }
  /**
   * 检查是否有自定义读写文件方法
   * @method initDriver
   * @param  {[function]}       readFileSystem  [description]
   * @param  {[function]}       writeFileSystem [description]
   * @return {[type]}                       [description]
   */
  initDriver (Driver) {
    this.driver = new Driver(this.options)
    // 如果驱动存在序列化方法，使用驱动自定义的序列化方法
    this.serialize = workerUtil.isFunction(this.driver.serialize) ? this.driver.serialize : this.serialize
    // 如果驱动存在反序列化方法，使用驱动自定义的反序列化方法
    this.unserialize = workerUtil.isFunction(this.driver.unserialize) ? this.driver.unserialize : this.unserialize
    // 打开长连接
    return this.driver.open()
    .catch(e => {
      // 提示打开失败
      logger.error('server rpc driver open fail')
      // 呈现错误
      logger.error(e)
      // 异常退出进程
      process.exit(-1)
    })
  }
  /**
   * 检查最后一次的关闭是否正常关闭还是异常关闭
   * @method serverCheckLastClose
   * @return {[type]}             [description]
   */
  checkLastClose () {
    return this.checkLastCloseByOnClose()
    .then(() => {
      return this.driver.read(1).then(res => this.unserialize(res))
      .catch(e => null)
    })
    .then(res => {
      if (res && res.gwcidTimeStamp) {
        // 发送启动给服务器
        return this.onServerStopEventRpcSend(res.gwcidTimeStamp)
      }
    })
  }
  checkLastCloseByOnClose () {
    return this.driver.lists()
    .then(lists => {
      var promises = []
      var indexs = []
      Array.isArray(lists) && lists.forEach(index => {
        if (index > 1) {
          indexs.push(index)
          promises.push(
            this.driver.read(index).then(res => this.unserialize(res))
          )
        }
      })
      return Promise.all(promises).then(res => {
        var gwcids = []
        Array.isArray(res) && res.forEach(lists => {
          gwcids = gwcids.concat(lists)
        })
        return {gwcids, indexs}
      })
    })
    .then(({gwcids, indexs}) => {
      var promises = []
      promises.push(this.onCloseEventRpcSend(gwcids))
      Array.isArray(indexs) && indexs.forEach(index => {
        promises.push(this.driver.remove(index))
      })
      return Promise.all(promises).then(res => true)
    })
  }
  /**
   * 发送推送事件给php
   * @method onServerStartEventRpcSend
   * @return {[type]}                    [description]
   */
  onServerStartEventRpcSend (gwcidTimeStamp) {
    return request(
      [this.options.rpcEvent.apiUrl, this.options.rpcEvent.onServerStart],
      this.buildParams({
        gwcidTimeStamp: gwcidTimeStamp || worker.gwcidTimeStamp,
        // 服务器唯一识别号
        serverGuid: this.serverGuid
      }),
      'PUT'
    )
    .catch(e => {
      logger.error('rpcEvent send fail')
      logger.error(e)
    })
  }
  /**
   * 发送推送事件给php
   * @method onServerStopEventRpcSend
   * @return {[type]}                    [description]
   */
  onServerStopEventRpcSend (gwcidTimeStamp) {
    return request(
      [this.options.rpcEvent.apiUrl, this.options.rpcEvent.onServerStop],
      this.buildParams({
        gwcidTimeStamp: gwcidTimeStamp || worker.gwcidTimeStamp,
        // 服务器唯一识别号
        serverGuid: this.serverGuid
      }),
      'PUT'
    )
    .catch(e => {
      logger.error('rpcEvent send fail')
      logger.error(e)
    })
  }
  /**
   * [onConnEventRpcSend 长连接打开，发送rpcEvent]
   * @method onConnEventRpcSend
   * @param  {[type]}               gwcid      [description]
   * @param  {[type]}               serverGuid [description]
   * @return {[type]}                          [description]
   */
  onConnEventRpcSend (gwcid, serverGuid) {
    return request([this.options.rpcEvent.apiUrl, this.options.rpcEvent.onConn], this.buildParams({
      // 全局链接id
      gwcid: gwcid,
      // 服务器唯一识别号
      serverGuid: serverGuid || this.serverGuid
    }), 'PUT')
    .catch(e => {
      logger.error('rpcEvent send fail')
      logger.error(e)
    })
  }
  /**
   * [onCloseEventRpcSend 长连接关闭，发送rpcEvent]
   * @method onCloseEventRpcSend
   * @param  {[type]}                gwcid      [description]
   * @param  {[type]}                serverGuid [description]
   * @return {[type]}                           [description]
   */
  onCloseEventRpcSend (gwcid, serverGuid) {
    if (!gwcid) {
      return Promise.reject(new Error(''))
    }
    if (Array.isArray(gwcid) && gwcid.length < 1) {
      return Promise.resolve()
    }
    return request([this.options.rpcEvent.apiUrl, this.options.rpcEvent.onClose], this.buildParams({
      // 全局链接id
      gwcid: Array.isArray(gwcid) ? gwcid : [gwcid],
      // 服务器唯一识别号
      serverGuid: serverGuid || this.serverGuid
    }), 'PUT')
    .catch(e => {
      logger.error('rpcEvent send fail')
      logger.error(e)
    })
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
    // 在gwcid 列表中加入gwcid
    this.addGwcid(gwcid)
    // 发送长连接连接事件到 事件服务器
    this.onConnEventRpcSend(gwcid, serverGuid)
  }
  /**
   * 触发onClose
   * @method emitOnClose
   * @return {[type]}    [description]
   */
  emitOnClose (gwcid, serverGuid) {
    // 在gwcid 列表中删除gwcid
    this.removeGwcid(gwcid)
    // 发送长连接断开事件到 事件服务器
    this.onCloseEventRpcSend(gwcid, serverGuid)
  }
  saveGwcidLists (index, isSave) {
    var indexs
    // 清理定时器
    Array.isArray(this.saveGwcidTimers) && this.saveGwcidTimers.forEach(timer => clearTimeout(timer))
    if (index !== void 0 && isSave !== true) {
      // 加入保存gwcid 的 indexs 中
      this.saveGwcidListsIndexs.indexOf(index) > -1 || this.saveGwcidListsIndexs.push(index)
      // 延时保存
      this.saveGwcidTimers.push(setTimeout(() => this.saveGwcidLists(index, true), this.saveTimeOut))
      // 中断操作
      return
    }
    // 如果有indexs就使用，否则保存全部
    indexs = (this.saveGwcidListsIndexs.length > 0) ? this.saveGwcidListsIndexs : Object.keys(this.gwcids)
    // 重置
    this.saveGwcidListsIndexs = []
    // 遍历开始保存
    Array.isArray(indexs) && indexs.forEach(index => this.saveGwcidListsByIndex(index))
  }
  saveGwcidListsByIndex (index) {
    // 因为数据库的id是从1开始
    // 1用于存储系统的数据
    // 所以2才是index为0的数据
    Promise.resolve(index + 2)
    .then((saveIndex) => {
      if (this.gwcids[index].length > 0) {
        // 序列化数据
        return this.serialize(this.gwcids[index])
        // 调用驱动保存
        .then(raw => this.driver.write(saveIndex, raw))
      } else {
        // 删除这条数据
        return this.driver.remove(saveIndex)
      }
    })
    .catch(e => {
      // 保存出错了
      logger.error('save gwcid lists by index fail')
      logger.error(e)
      // 重试咯
      this.saveGwcidLists(index)
    })
  }
  removeGwcid (gwcid) {
    var index, i
    index = getIndexByGwcid(gwcid)
    if (Array.isArray(this.gwcids[index])) {
      // 默认下标为-1
      i = -1
      // 循环查找下标，直到找不到为止，标准是i为-1
      while ((i = this.gwcids[index].indexOf(gwcid)) > -1) {
        // 数组中切除
        this.gwcids[index].splice(i, 1)
      }
    }
    // 保存指定的index
    this.saveGwcidLists(index)
  }
  addGwcid (gwcid) {
    var index = getIndexByGwcid(gwcid)
    if (!Array.isArray(this.gwcids[index])) {
      this.gwcids[index] = []
    }
    // 插入列表
    this.gwcids[index].push(gwcid)
    // 保存指定的index
    this.saveGwcidLists(index)
  }
  serialize (data) {
    // 默认序列化使用JSON
    return Promise.resolve(JSON.stringify(data))
  }
  unserialize (raw) {
    // 默认序列化使用JSON
    return Promise.resolve(JSON.parse(raw))
  }
  buildParams (data, isQuery) {
    return workerUtil.buildParams(data, isQuery)
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
  wcid = wcid.split('-').slice(0, 2)
  index = (parseInt(wcid[1] || '0', 36)) % (parseInt(modulo) || 50)
  return index
}

// urlEncode 编码
Object.assign(workerUtil, {
  // 编码对照数组表
  kEscapedMap: {
    '!': '%21',
    '\'': '%27',
    '(': '%28',
    ')': '%29',
    '*': '%2A'
  },
  // 编码
  urlEncode: function urlEncode (string, encodingSlash) {
    var result = encodeURIComponent(string)
    result = result.replace(/[!'()*]/g, function ($1) {
      return workerUtil.kEscapedMap[$1]
    })
    if (encodingSlash === false) {
      result = result.replace(/%2F/gi, '/')
    }
    return result
  },
  // path编码
  urlEncodeExceptSlash: function urlEncodeExceptSlash (value) {
    return workerUtil.urlEncode(value, false)
  }
})
// 对象序列化
Object.assign(workerUtil, {
  // 编码
  buildParams: function buildParams (data, isQuery) {
    var r = workerUtil._buildParamsToArray(data, '').join('&')
    if (isQuery) {
      r = r.replace(/%20/gi, '+')
    }
    return r
  },

  _buildParamsToArray: function _buildParamsToArray (data, prefix) {
    var r = []
    var i, key, keyt, value
    if (typeof data === 'object') {
      // 数组
      if (workerUtil.isArray(data)) {
        for (i = 0; i < data.length; i++) {
          // 值
          value = data[i]
          if (value === void 0) continue
          // 键
          keyt = workerUtil._buildParamsAddPrefix(i, prefix, (typeof value === 'object'))
          // 递归处理对象和数组
          if (typeof value === 'object') {
            // 插入数组
            r.push.apply(r, workerUtil._buildParamsToArray(value, keyt))
          } else {
            // 插入数组
            r.push(workerUtil.urlEncode(keyt) + '=' + workerUtil.urlEncode(value))
          }
        }
      } else {
        for (key in data) {
          if (!Object.hasOwnProperty.call(data, key)) {
            continue
          }
          // 值
          value = data[key]
          if (value === void 0) continue
          // 键
          keyt = workerUtil._buildParamsAddPrefix(key, prefix)
          if (typeof value === 'object') {
            // 插入数组
            r.push.apply(r, workerUtil._buildParamsToArray(value, keyt))
          } else {
            // 插入数组
            r.push(workerUtil.urlEncode(keyt) + '=' + workerUtil.urlEncode(value))
          }
        }
      }
    }
    return r
  },
  _buildParamsAddPrefix: function _buildParamsAddPrefix (key, prefix, isNotArray) {
    if (prefix) {
      return prefix + '[' + (isNotArray !== false ? key : '') + ']'
    } else {
      return key
    }
  }
})
