'use strict'

const RpcBaseEvent = require('./RpcBaseEvent.js')
const ddvRowraw = require('ddv-rowraw')

class RpcEvent extends RpcBaseEvent {
  constructor (options, ws, req) {
    super(options, ws, req)
    this.init()
  }
  init () {
    // 获取文件事件
    this.on(['rpc', 'call', '/v1_0/push/send'], (headers, body, res) => console.log(headers, body, this.serverGuid, this.gwcidTimeStamp, res) || this.send(ddvRowraw.stringify({request_id: headers.request_id}, 'body', `RPC/1.0 200 OK`)))
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
