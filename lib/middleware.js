//
// Builds up a series of middleware functions into a big promise that
// resolves the middleware in the order they were added via `.on`
//
//
const { compact, isFunction } = require('lodash')

exports.buildMiddlewares = (middleware) => (mappedQuery) => {
  let res = {}
  let ended = false
  const state = {}
  const promiseThunks = middleware.map(({ prop, next }) => {
    const req = prop.split('.').reduce((a, b) => a && a[b], mappedQuery)
    const ctx = {
      req,
      res,
      state,
      end: (endRes) => {
        if (endRes) res = endRes
        ended = true
      }
    }
    if (req && !ended) return () => next(ctx)
    else return () => Promise.resolve()
  })
  const final = compact(promiseThunks)
    .reduce((prev, cur) => {
      return (isFunction(prev) ? prev() : prev).then(cur)
    })
  return (isFunction(final) ? final() : final).then(() => res)
}

exports.addRoute = (middleware) => (route, next) => {
  route.split(' ').forEach((prop) => middleware.push({ prop, next }))
}
