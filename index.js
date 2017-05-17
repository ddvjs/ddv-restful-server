'use strict'
const fs = require('fs')
const worker = require('ddv-worker')
const logger = require('./lib/logger.js')
// 导出 expressWorker
module.exports = worker

var isServerStart = false
worker.serverStart = function serverStart (options, siteConfigFile) {
  if (isServerStart) {
    logger.error('Please do not start many times')
    return
  }
  isServerStart = true
  if (!fs.existsSync(options.appPath)) {
    logger.error('Options.appPath does not exist, please check')
    return
  }
  require('ddv-worker-express-ws')(options)
  // 运行app
  require(options.appPath)
  // 监听服务 - Listen the server
  worker.updateServerConf({
    defaultListen: options.defaultListen,
    listen: options.listen,
    cpuLen: options.cpuLen
  }).then(res => {
    logger.log('listen updated success')
    logger.log(res)
  }, e => {
    logger.log('listen updated fail')
    logger.error(e)
  })
}
