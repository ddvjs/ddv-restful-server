'use strict'

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
    return getClientWs(guid, this.options)
    .then(client => {
      return client.request({
        rpc_id: rpcId,
        guid: guid,
        wcids: JSON.stringify(wcids),
        headers: JSON.stringify(headers),
        time_stamp: timeStamp
      }, body, `CALL ${path} RPC/1.0`)
      .then(res => {
        console.log('resdfsfsdfsfss', res)
      })
    })
  }
}
module.exports = RpcCall
