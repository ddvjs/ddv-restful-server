'use strict'

const ddvRowraw = require('ddv-rowraw')
const RpcBaseServer = require('./RpcBaseServer.js')
const getClientWs = require('./getClientWs.js')

class RpcCall extends RpcBaseServer {
  constructor (options, req, res, next) {
    super(options, req, res, next)
    this.init()
  }
  init () {
  }
  rpcCall (rpcId, guid, wcids, headers, body, path, timeStamp) {
    return Promise.all([
      getClientWs(guid),
      ddvRowraw.stringifyPromise({
        rpc_id: rpcId,
        guid: guid,
        wcids: JSON.stringify(wcids),
        headers: JSON.stringify(headers),
        time_stamp: timeStamp
      }, body, `CALL ${path} RPC/1.0`)
    ])
    .then((ws, raw) => {
      console.log(raw)
      console.log(raw.toString())
      return Promise.reject(new Error('44'))
    })
  }
}
module.exports = RpcCall
