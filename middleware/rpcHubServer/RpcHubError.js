class RpcHubError extends Error {
    // 构造函数
  constructor (message, errorId, stack, name, type) {
      // 调用父类构造函数
    super(message)
    this.errorId = errorId || message || 'Error'
    this.name = name || this.name || 'Error'
    this.type = type || this.type || 'RpcHubError'
    this.stack += stack ? ('\n' + stack) : ''
    message = stack = void 0
  }
}
module.exports = RpcHubError
