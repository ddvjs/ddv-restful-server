'use strict'

const RpcBaseEvent = require('./RpcBaseEvent.js')

class RpcEvent extends RpcBaseEvent {
  constructor (options, ws, req) {
    super(options, ws, req)
    this.init()
  }
  init () {
  }
  rpcCall (path, wcids) {
    return new Promise(function (resolve, reject) {

    })
  }
}
module.exports = RpcEvent
