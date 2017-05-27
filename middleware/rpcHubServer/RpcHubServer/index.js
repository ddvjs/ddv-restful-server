'use strict'

const RpcBaseServer = require('./RpcBaseServer.js')
const rpcClient = require('../rpcClient')

class RpcCall extends RpcBaseServer {
  constructor (options, req, res, next) {
    super(options, req, res, next)
    this.init()
  }
  // 初始化
  init () {
  }
  // 建立连接
  rpcCall (rpcId, guid, wcids, headers, body, path, timeStamp) {
    return rpcClient(guid, this.options)
    .then(client => {
      // 向客户端发出请求
      return client.request({
        rpc_id: rpcId,
        guid: guid,
        wcids: JSON.stringify(wcids),
        headers: JSON.stringify(headers),
        time_stamp: timeStamp
      }, body, `CALL ${path} RPC/1.0`)
      .then(res => {
        // {success, fails}
        console.log('resdfsfsdfsfss', res)
      })
      .catch(e => {
        console.log('e', e)
        e.errorId = ''
        e.message = ''
        return Promise.reject(e)
      })
    })
  }
}
module.exports = RpcCall
