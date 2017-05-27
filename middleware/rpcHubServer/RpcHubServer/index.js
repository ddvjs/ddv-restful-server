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
      .then(({body}) => {
        var res
        try {
          res = JSON.parse(body)
        } catch (e) {
          e.errorId = e.errorId || 'JSON_PARSE_ERROR'
          return Promise.reject(e)
        }
        return res
      })
      .catch(e => {
        var res = {}
        try {
          res = JSON.parse(e.body)
        } catch (e1) {
          res = e
        }
        res.errorId = e.errorId = res.errorId || 'RPC_CALL_ERROR_ON_HUB'
        res.message = e.message = res.message || 'rpcCall error on Hub'
        return Promise.reject(res)
      })
      .then(res=>{
        console.log('\n\nres===',res)
        return res
      })
    })
  }
}
module.exports = RpcCall
