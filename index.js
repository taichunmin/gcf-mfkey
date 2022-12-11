const _ = require('lodash')
const { MFKEY32, MFKEY32V2, MFKEY64 } = require('@bettse/mfkey')
const functions = require('@google-cloud/functions-framework')
const httpError = require('http-errors')

const padMfkey = key => key.toString(16).toUpperCase().padStart(12, '0')

const middlewares = [
  // error handler
  async (ctx, next) => {
    try {
      return await next()
    } catch (err) {
      exports.log('ERROR', err)
      ctx.res.status(err.status || 500).send(err.message)
    }
  },

  // cors
  async (ctx, next) => {
    const origin = ctx.req.get('Origin') || '*'
    ctx.res.set('Access-Control-Allow-Origin', origin)
    ctx.res.set('Access-Control-Allow-Credentials', 'true')

    if (ctx.req.method !== 'OPTIONS') return await next()

    ctx.res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    ctx.res.set('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')
    ctx.res.set('Access-Control-Max-Age', '3600')
    ctx.res.set('Vary', 'Origin')
    ctx.res.status(204).send('')
  },

  // mfkey32
  async (ctx, next) => {
    const { req, res } = ctx
    if (req.method !== 'POST' || req.path !== '/mfkey32') return await next()
    const args = []
    for (const k of ['uid', 'nt0', 'nr0', 'ar0', 'nr1', 'ar1']) {
      const val = req.body?.[k]
      if (!/^[0-9a-fA-F]{8}$/.test(val)) throw new httpError(400, `invalid ${k}`)
      args.push(_.parseInt(val, 16))
    }
    const key = padMfkey(MFKEY32(...args))
    res.json({ key })
  },

  // mfkey32v2
  async (ctx, next) => {
    const { req, res } = ctx
    if (req.method !== 'POST' || req.path !== '/mfkey32v2') return await next()
    const args = []
    for (const k of ['uid', 'nt0', 'nr0', 'ar0', 'nt1', 'nr1', 'ar1']) {
      const val = req.body?.[k]
      if (!/^[0-9a-fA-F]{8}$/.test(val)) throw new httpError(400, `invalid ${k}`)
      args.push(_.parseInt(val, 16))
    }
    const key = padMfkey(MFKEY32V2(...args))
    res.json({ key })
  },

  // mfkey64
  async (ctx, next) => {
    const { req, res } = ctx
    if (req.method !== 'POST' || req.path !== '/mfkey64') return await next()
    const args = []
    for (const k of ['uid', 'nt', 'nr', 'ar', 'at']) {
      const val = req.body?.[k]
      if (!/^[0-9a-fA-F]{8}$/.test(val)) throw new httpError(400, `invalid ${k}`)
      args.push(_.parseInt(val, 16))
    }
    const key = padMfkey(MFKEY64(...args))
    res.json({ key })
  },

  // 404
  async (ctx, next) => {
    throw new httpError(404, 'Not Found')
  },
]

exports.middlewareCompose = middleware => {
  // 型態檢查
  if (!_.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
  if (_.some(middleware, fn => !_.isFunction(fn))) throw new TypeError('Middleware must be composed of functions!')

  return async (context = {}, next) => {
    const cloned = [...middleware, ...(_.isFunction(next) ? [next] : [])]
    const executed = _.times(cloned.length + 1, () => 0)
    const dispatch = async cur => {
      if (executed[cur] !== 0) throw new Error(`middleware[${cur}] called multiple times`)
      if (cur >= cloned.length) {
        executed[cur] = 2
        return
      }
      try {
        executed[cur] = 1
        const result = await cloned[cur](context, () => dispatch(cur + 1))
        if (executed[cur + 1] === 1) throw new Error(`next() in middleware[${cur}] should be awaited`)
        executed[cur] = 2
        return result
      } catch (err) {
        executed[cur] = 3
        throw err
      }
    }
    return await dispatch(0)
  }
}

exports.errToPlainObj = (() => {
  const ERROR_KEYS = [
    'address',
    'code',
    'data',
    'dest',
    'errno',
    'info',
    'message',
    'name',
    'path',
    'port',
    'reason',
    'response.data',
    'response.headers',
    'response.status',
    'stack',
    'status',
    'statusCode',
    'statusMessage',
    'syscall',
  ]
  return err => _.pick(err, ERROR_KEYS)
})()

exports.log = (() => {
  const LOG_SEVERITY = ['DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY']
  return (...args) => {
    let severity = 'DEFAULT'
    if (args.length > 1 && _.includes(LOG_SEVERITY, _.toUpper(args[0]))) severity = _.toUpper(args.shift())
    _.each(args, arg => {
      if (_.isString(arg)) arg = { message: arg }
      if (arg instanceof Error) arg = exports.errToPlainObj(arg)
      console.log(JSON.stringify({ severity, ...arg }))
    })
  }
})()

const handler = exports.middlewareCompose(middlewares)
functions.http('main', (req, res) => handler({ req, res }))