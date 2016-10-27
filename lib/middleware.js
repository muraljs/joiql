//
// Builds up a series of middleware functions into a big promise that
// resolves the middleware in the order they were added via `.on`
//
const compose = require('koa-compose')

exports.buildMiddlewares = (middlewares) => (req) => {
  const ctx = { res: {}, req, state: {} }
  return compose(middlewares)(ctx).then(() => ctx.res)
}

exports.addMiddleware = (middlewares) => (middleware) =>
  middlewares.push(middleware)
