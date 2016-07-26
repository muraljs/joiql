const joiql = require('../')
const { object, string, number, array, date } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')

// Joi Schemas
const Film = object({
  title: string(),
  producers: array().items(string()),
  release_date: date()
})

const Person = object({
  name: string(),
  films: array().items(Film)
}).meta({
  args: { id: number().required() }
})

// Convert Joi schemas to GraphQL
const api = joiql({
  query: {
    person: Person,
    film: Film
  }
})

// Middleware to resolve the request
// (returning promises to mimic async functions)
api.on('query.film', (ctx) => {
  ctx.res.film = { title: 'bar' }
  return Promise.resolve()
})
api.on('query.person', (ctx) => {
  ctx.res.person = { name: 'Spike Jonze' }
  return Promise.resolve()
})
api.on('query.person.fields.films', (ctx) => {
  ctx.res.person.films = [
    { title: 'Her', producers: ['Annapurna'] },
    { title: 'Adaptation', producers: ['Kaufman'] }
  ]
  return Promise.resolve()
})

// Mount schema to express
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
app.listen(3000, () => console.log('listening on 3000'))
