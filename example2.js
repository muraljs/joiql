const joiql = require('./')
const { object, string, number } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')
const { uniqueId, pick } = require('lodash')

// Fake database
const _db = {}

const db = {
  find: (id) => _db[id],
  save: (doc) => {
    return new Promise((resolve) => {
      _db[doc.id || uniqueId()] = doc
      resolve(doc)
    })
  }
}

// Schemas
const Author = {
  id: number(),
  name: string().required(),
  email: string().email()
}

const Article = {
  id: number(),
  title: string().required().min(10).max(150),
  authorId: number()
}

// Setup
const api = joiql({
  query: {
    article: object(Article).meta({ args: pick(Article, 'id') })
  },
  mutation: {
    article: object(Article).meta({ args: Article }),
    author: object(Author).meta({ args: Author })
  }
})

api.on('mutation.article', ({ args }, res) => {
  return db.save(args).then((article) => {
    res.article = article
  })
})

api.on('mutation.article.args.authorId', (id, res) => {
  console.log('go update author', id)
})

// Mount
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))

app.listen(3000, () => console.log('listening on 3000'))
