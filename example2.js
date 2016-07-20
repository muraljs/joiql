const joiql = require('./')
const { object, string, number } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')
const { graphql } = require('graphql')

const Article = {
  id: number(),
  title: string().required().max(150),
  author: object({
    id: string(),
    name: string(),
    bio: string()
  }),
  body: string()
}
const ArticleQuery = object(Article).meta({
  args: { id: number().required() }
})

const schema = joiql({
  query: {
    article: ArticleQuery
  }
}, (query) => {
  const res = {}
  if (query.article) res.article = { title: '10 cat videos' }
  return res
})

graphql(schema, `
  query {
    article(id: 1) {
      id
    }
  }
`).then((r) => console.log(r))

// app.use('/graphql', graphqlHTTP({
//   schema: schema,
//   graphiql: true
// }))

// app.listen(3000, () => console.log('listening on 3000'))
