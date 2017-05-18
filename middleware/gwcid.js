'use strict'

const worker = require('ddv-worker')
const util = require('ddv-worker/util')

module.exports = function gwcidMiddleware (options) {
  return function gwcid (req, res, next) {
    req.connId = util.createNewPid()
    req.connTime = util.time()
    req.workerId = worker.id
    req.serverGuid = worker.serverGuid
    req.gwcidTimeStamp = worker.gwcidTimeStamp
    req.gwcid = `${req.serverGuid}-${req.workerId}-${req.connId}-${req.gwcidTimeStamp}`
    next()
  }
}
