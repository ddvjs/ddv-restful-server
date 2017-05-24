'use strict'

module.exports = request
const url = require('url')
const http = require('http')
const https = require('https')

function request (urlInputs, body, method, contentType) {
  var opt, requestfn
  if (typeof urlInputs === 'object') {
    opt = urlInputs
  } else {
    let urlObj
    let urlInput = ''
    if (Array.isArray(urlInputs)) {
      urlInputs.forEach(t => {
        urlInput += t
      })
    } else {
      urlInput = urlInputs
    }
    urlInput = url.format(urlInput)
    urlObj = url.parse(urlInput)

    opt = {
      protocol: (urlObj.protocol || 'http:'),
      host: urlObj.host,
      port: urlObj.port,
      path: urlObj.path
    }
    urlObj = urlInput = void 0
  }
  opt.method = opt.method || method || 'GET'
  body = body || new Buffer(0)
  if (!Buffer.isBuffer(body)) {
    if (typeof body !== 'string') {
      body = body.toString()
    }
    body = new Buffer(body, 'utf-8')
  }
  contentType = contentType || 'application/x-www-form-urlencoded; charset=UTF-8'
  var isContentType = false
  var isContentLength = false
  opt.headers = typeof opt.headers === 'object' ? opt.headers : {}
  Object.keys(opt.headers).forEach(key => {
    switch (key.toLowerCase()) {
      case 'content-type' :
        isContentType = true
        opt.headers[key] = opt.headers[key] || contentType
        break
      case 'content-length' :
        isContentLength = true
        opt.headers[key] = opt.headers[key] || (body.length || 0)
        break
    }
  })
  if (!isContentType) {
    opt.headers['Content-Type'] = contentType
  }
  if (!isContentLength) {
    opt.headers['Content-Length'] = body.length || 0
  }
  opt.port = opt.protocol === 'https:' ? 443 : 80
  opt.headers.Host = opt.host
  requestfn = opt.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    var req
    req = requestfn(opt, response => {
      var body = new Buffer(0)
      response.on('data', chunk => { body = Buffer.concat([body, chunk]) })
      response.on('end', () => {
        resolve({
          headers: response.headers,
          statusCode: response.statusCode || '200',
          statusMessage: response.statusMessage || 'OK',
          body
        })
      })
    })

    req.write(body)
    req.on('error', e => reject(e))
    req.end()
  })
}
