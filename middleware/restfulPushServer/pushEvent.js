'use strict'
const EventEmitter = require('events')
const wsConnQueue = require('./wsConnQueue.js')
const workerUtil = require('ddv-worker/util')
const PushBaseEvent = require('./PushBaseEvent.js')
const ddvRowraw = require('ddv-rowraw')
const logger = require('../../lib/logger.js')
class PushEvent extends PushBaseEvent {
  constructor (options, ws, req) {
    super(options, ws, req)
    this.pushEventInit()
  }
  pushEventInit () {
  }
}
module.exports = PushEvent