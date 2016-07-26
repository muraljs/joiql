const joiql = require('../')
const { object, string, number, array, date } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')
const { uniqueId, assign, map } = require('lodash')

const _db = {}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const db = {
  find: (col, id) =>
    delay(50).then(() => db[col] && db[col][id]),
  save: (col, doc) =>
    delay(50).then(() => {
      const id = doc.id || uniqueId()
      const res = assign(doc, { id })
      if (!_db[col]) _db[col] = {}
      _db[col][id] = res
    })
}

const ArticleAttrs = {
  id: number(),
  title: string().required().min(10),
  created_at: date(),
  blocks: array().items(
    object({
      type: string().valid('image'),
      src: string()
    }).meta({ name: 'ImageBlock' }),
    object({
      type: string().valid('text'),
      body: string()
    }).meta({ name: 'TextBlock' })
  ).default([])
}

const api = joiql({
  query: {
    article: object(ArticleAttrs).meta({
      name: 'ArticleQuery',
      args: { id: number() }
    }),
    articles: object(ArticleAttrs).meta({
      name: 'ArticlesQuery',
      args: { limit: number() }
    })
  },
  mutation: {
    article: object(ArticleAttrs).meta({
      name: 'ArticleMutation',
      args: ArticleAttrs
    })
  }
})

api.on('mutation', ({ req, res }) => {
  const promises = map(req, ({ args }, col) => {
    return db.save(col, args).then((doc) => { res[col] = doc })
  })
  console.log('mutating1')
  return Promise.all(promises)
})
api.on('mutation', ({ req, res }) => {
  console.log('mutating2')
  return delay(50)
})
api.on('mutation', ({ res }) => {
  console.log('db results', _db, res)
  return Promise.resolve()
})

app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))

app.listen(3000, () => console.log('listening on 3000'))
