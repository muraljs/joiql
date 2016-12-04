const joiql = require('./')
const { object, string, number, array, date } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')

// Joi Schemas
const Film = object({
  title: string(),
  producers: array().items(string()).meta({
    resolve: () => ['']
  }),
  release_date: date()
}).meta({
  resolve: () => ({ title: 'Her' })
})

const Person = object({
  name: string(),
  films: array().items(Film)
}).meta({
  args: { id: number().required() },
  resolve: () => ({ name: 'Spike Jonze' })
})

// Convert Joi schemas to GraphQL
const schema = joiql({
  query: {
    person: Person,
    film: Film
  }
})

// Mount schema to express
app.use('/', graphqlHTTP({ schema: schema, graphiql: true }))
app.listen(3000, () => console.log('listening on 3000'))
