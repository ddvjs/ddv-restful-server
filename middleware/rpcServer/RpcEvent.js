'use strict'

const RpcBaseEvent = require('./RpcBaseEvent.js')
// const ddvRowraw = require('ddv-rowraw')

class RpcEvent extends RpcBaseEvent {
  constructor (options, rpcCall, ws, req) {
    super(options, ws, req)
    this.rpcCallInit(rpcCall)
  }
  rpcCallInit (rpcCall) {
    this.rpcCall = rpcCall
  }
  rpcCall (path, wcids, body) {
    return new Promise(function (resolve, reject) {
      console.log('信息', body)
      console.log('开始分解wcids', wcids)
    })
  }
}
module.exports = RpcEvent
