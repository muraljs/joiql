const { map, uniqueId, assign, values, keys } = require('lodash')

const _db = {}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const db = {
  findOne: (col, id) =>
    delay(50).then(() => _db[col] && _db[col][id]),
  save: (col, doc) =>
    delay(50).then(() => {
      const id = doc.id || uniqueId()
      const res = assign(doc, { id })
      if (!_db[col]) _db[col] = {}
      _db[col][id] = res
      return res
    })
}

exports.persist = (ctx, next) => {
  const finds = map(ctx.req.query, (branch, key) => {
    const isAlias = !branch.args
    const args = isAlias ? values(branch)[0].args : branch.args
    const col = isAlias ? keys(branch)[0] : key
    return db
      .findOne(col, args.id)
      .then((doc) => { ctx.res[key] = doc })
  })
  const saves = map(ctx.req.mutation, ({ args }, col) =>
    db.save(col, args).then((doc) => { ctx.res[col] = doc }))
  return Promise.all(finds.concat(saves)).then(next)
}

exports.log = (ctx, next) => {
  const start = new Date().getTime()
  return next().then(() => console.log('Request took ', new Date().getTime() - start))
}
