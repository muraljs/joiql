const cache = {}

exports.get = ({ req, state, res, end }) => {
  state.key = JSON.stringify(req)
  if (cache[state.key]) end(cache[state.key])
  return Promise.resolve()
}

exports.set = ({ req, res }) => {
  cache[JSON.stringify(req)] = res
}
