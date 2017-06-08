'use strict'
const path = require('path')
const fs = require('fs')
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
  write (relativePath, buffer) {
    return new Promise((resolve, reject) => {
      var filePath = path.resolve(this.serverRpcEventCacheRoot, relativePath)
      // 不编码，只写不读
      fs.writeFile(filePath, buffer, {encoding: null, flag: 'w'}, err => {
        err ? reject(err) : resolve()
      })
    })
  }
  remove (relativePath) {
    return new Promise((resolve, reject) => {
      var filePath = path.resolve(this.serverRpcEventCacheRoot, relativePath)
      // 不编码，只写不读
      fs.unlink(filePath, err => {
        err ? reject(err) : resolve()
      })
    })
  }
  lists (relativePath) {
    var filePath
    return new Promise((resolve, reject) => {
      filePath = path.resolve(this.serverRpcEventCacheRoot, (relativePath || '/'))
      fs.readdir(filePath, (err, files) => {
        err ? reject(err) : resolve(files)
      })
    })
    .then(files => {
      var listsArray = []
      var promises = []
      files.forEach(filename => {
        promises.push(
          fsstat(path.join(filePath, filename))
          .then(stats => {
            if (stats.isFile()) {
              listsArray.push(filename)
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
    return Promise.resolve(true)
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
