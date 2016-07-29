const joiql = require('../../')
const app = require('express')()
const graphqlHTTP = require('express-graphql')
const db = require('./db')
const Article = require('./article')
const Vertical = require('./vertical')

const api = joiql({
  query: {
    article: Article.Query,
    vertical: Vertical.Query
  },
  mutation: {
    article: Article.Mutation,
    vertical: Vertical.Mutation
  }
})

api.on('query', db.fetch)
api.on('mutation', db.save)
api.on('query mutation', db.log)

app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))

app.listen(3000, () => console.log('listening on 3000'))
