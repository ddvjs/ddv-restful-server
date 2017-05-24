'use strict'

const RpcBaseEvent = require('./RpcBaseEvent.js')
const ddvRowraw = require('ddv-rowraw')

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
      this._wcidGroupParse(wcids)
    })
  }
  _wcidGroupParse (wcids) {
    var wcidsObj = Object.create(null)
    let wcidsArray = wcids || []
    wcidsArray.forEach(item => {
      var temp = item.split('-')

      if (wcidsObj[temp[0]] && Array.isArray(wcidsObj[temp[0]])) {
        wcidsObj[temp[0]].push(temp[1])
      } else {
        wcidsObj[temp[0]] = [temp[1]]
      }
    })
    wcidsArray = void 0
    return wcidsObj
  }
}
module.exports = RpcEvent
