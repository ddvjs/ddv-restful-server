'use strict'
const https = require('https')
const http = require('http')
const PushError = require('./PushError')

module.exports = apiModelProxy

function apiModelProxy (res, options) {
  return getOpt(res)
  .then(opt => {
    return checkHost(opt.host, (options.apiModelProxyHosts || []))
    .then(host => { opt.host = host })
    .then(() => opt)
  })
  .then(opt => {
    return new Promise((resolve, reject) => {
      var req
      var data = new Buffer(0)
      req = (opt.protocol === 'https:' ? https : http).request(opt, response => {
        // 接收数据
        response.on('data', chunk => {
          data = Buffer.concat([data, chunk])
          chunk = void 0
        })
        // 接收结束
        response.on('end', () => {
          resolve({
            headers: response.headers,
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            data
          })
        })
      })
      req.on('error', e => {
        e.errorId = e.errorId || 'requestError'
        reject(e)
      })
      req.write(res.body)
      req.end()
      req = undefined
    })
  })
}
function getOpt (res) {
  if (!(res.headers && res.headers.headers)) {
    return Promise.reject(new PushError('Must have a headers object', 'MUST_HAVE_A_HEADERS'))
  }
  var hadersTemp = Object.create(null)
  try {
    hadersTemp = JSON.parse(res.headers.headers)
  } catch (e) {
    return Promise.reject(new PushError('The Headers must be a json object', 'HEADERS_MUST_BE_A_JSON'))
  }
  // 发送服务器参数
  var opt = {
    method: res.method || 'GET',
    protocol: res.headers.protocol || 'http:',
    host: res.headers.host || null,
    port: res.headers.port || null,
    path: res.path || '/',
    headers: hadersTemp
  }
  if (!opt.host) {
    return Promise.reject(new PushError('Must have a host object', 'MUST_HAVE_A_HOST'))
  }
  if (!opt.port) {
    opt.port = res.headers.protocol === 'https:' ? 443 : 80
  }
  return Promise.resolve(opt)
}
function checkHost (host, apiModelProxyHosts) {
  if (Array.isArray(apiModelProxyHosts)) {
    return apiModelProxyHosts.indexOf(host) > -1 ? Promise.resolve() : Promise.reject(new PushError('The host does not exist in the apiModelProxyHosts', 'MUST_HAVE_A_HOST_IN_APIMODELPROXYHOSTS'))
  } else {
    var hostt
    for (hostt in apiModelProxyHosts) {
      if (host === hostt) {
        return Promise.resolve(apiModelProxyHosts[hostt])
      }
    }
  }
  return Promise.reject(new PushError('The host does not exist in the apiModelProxyHosts', 'MUST_HAVE_A_HOST_IN_APIMODELPROXYHOSTS'))
}
