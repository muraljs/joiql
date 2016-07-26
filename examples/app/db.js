const { map, uniqueId, assign } = require('lodash')

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

module.exports.fetch = ({ req, res }) => {
  const promises = map(req, ({ args }, col) => {
    return db.findOne(col, args.id).then((doc) => {
      return res[col] = doc
    })
  })
  return Promise.all(promises)
}

module.exports.save = ({ req, res }) => {
  const promises = map(req, ({ args }, col) => {
    return db.save(col, args).then((doc) => { res[col] = doc })
  })
  return Promise.all(promises)
}

module.exports.log = ({ res }) => {
  return Promise.resolve()
}

module.exports.db = db
