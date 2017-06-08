'use strict'
const path = require('path')
const mkdirp = require('mkdirp')
const workerUtil = require('ddv-worker/util')
const fs = require('fs')
const fileNameReg = /^([a-z\d]+).ddv.json$/i
class serverRpcDriver {
  constructor (options) {
    this.initOptions(options)
  }
  initOptions (options) {
    this.options = options || this.options
  }

  /**
   * 读取文件
   * @method readFileSystem
   * @param  {[string]}       relativePath [description]
   * @return {[function]}                    [description]
   */
  read (relativePath) {
    return this.getFilePath(relativePath)
    .then((filePath) => {
      return new Promise((resolve, reject) => {
        // 不编码，只读不写
        fs.readFile(filePath, {encoding: null, flag: 'r'}, (err, buffer) => {
          err ? reject(err) : resolve(buffer)
        })
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
  write (relativePath, buffer) {
    return this.getFilePath(relativePath)
    .then((filePath) => {
      return new Promise((resolve, reject) => {
      // 不编码，只写不读
        fs.writeFile(filePath, buffer, {encoding: null, flag: 'w'}, err => {
          err ? reject(err) : resolve()
        })
      })
    })
  }
  remove (relativePath) {
    return this.getFilePath(relativePath)
    .then((filePath) => {
      return new Promise((resolve, reject) => {
      // 不编码，只写不读
        fs.unlink(filePath, err => {
          err ? reject(err) : resolve()
        })
      })
    })
  }
  lists () {
    return new Promise((resolve, reject) => {
      fs.readdir(this.serverRpcEventCacheRoot, (err, files) => {
        err ? reject(err) : resolve(files)
      })
    })
    .then(files => {
      var listsArray = []
      var promises = []
      files.forEach(filename => {
        promises.push(
          fsstat(path.join(this.serverRpcEventCacheRoot, filename))
          .then(stats => {
            if (stats.isFile()) {
              let res = fileNameReg.exec(filename)
              if (res && res[1]) {
                listsArray.push(res[1])
              }
            }
          })
        )
      })
      return Promise.all(promises).then(() => listsArray)
    })
  }
  /**
   * [open 打开连接，在开始用的时候，用于远程连接数据库打开等动作]
   * @method open
   * @return Promise [description]
   */
  open () {
  // 缓存文件路径
    this.serverRpcEventCacheRoot = this.options.serverRpcEventCacheRoot

    if (!this.serverRpcEventCacheRoot) {
      this.serverRpcEventCacheRoot = path.join(this.options.appPath, './serverRpcEventCache/')
    }
    return new Promise((resolve, reject) => {
      // 递归创建目录
      mkdirp(this.serverRpcEventCacheRoot, (err) => {
        err ? reject(err) : resolve(true)
      })
    })
  }
  /**
   * [close 打开连接，在开始用的时候，用于远程连接数据库打开等动作]
   * @method close
   * @return Promise [description]
   */
  close () {
    return Promise.resolve(true)
  }
  serialize (data) {
    return Promise.resolve(JSON.stringify(data))
  }
  unserialize (raw) {
    return Promise.resolve(JSON.parse(raw))
  }
  getFilePath (relativePath) {
    if (workerUtil.isNumber(relativePath)) {
      relativePath = relativePath.toString()
    }
    var filePath = path.join(this.serverRpcEventCacheRoot, relativePath + '.ddv.json')
    return Promise.resolve(filePath)
  }
}
module.exports = serverRpcDriver
module.exports.fsstat = fsstat

function fsstat (filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      err ? reject(err) : resolve(stats)
    })
  })
}
