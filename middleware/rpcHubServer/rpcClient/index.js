module.exports = getClientWs
const RpcHubError = require('../RpcHubError')
const clientWsQueue = require('./clientWsQueue.js')
const ClientWs = require('./ClientWs.js')
function getClientWs (guid, options) {
  var client
  if (!guid) {
    return Promise.reject(new RpcHubError('Guid can not be empty', 'GUID_EMPTY'))
  }
  // 如果已经有该客户端就直接返回
  if (clientWsQueue[guid] && clientWsQueue[guid] instanceof ClientWs && clientWsQueue[guid].state) {
    return Promise.resolve(clientWsQueue[guid])
  }
  client = clientWsQueue[guid] = new ClientWs(guid, options)
  client.on('close', () => {
    delete clientWsQueue[guid]
  })
  client = options = void 0
  return Promise.resolve(clientWsQueue[guid])
}
