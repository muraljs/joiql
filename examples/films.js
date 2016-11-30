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
})
// .args({ id: number().required() })
.meta({
  args: { id: number().required() }
})

// Convert Joi schemas to GraphQL
const api = joiql({
  query: {
    person: Person,
    film: Film
  }
})

// Koa 2 style middleware to resolve the request
// (using promises in anticipation of async/await)
api.use((ctx, next) => {
  ctx.res.twb = { title: 'There will be blood' }
  ctx.res.her = { title: 'Her' }
  ctx.res.film = { title: 'Paul Blart Mall Cop' }
  return next()
})
api.use((ctx, next) => {
  ctx.res.person = { name: 'Spike Jonze' }
  return next()
})
api.use((ctx, next) => {
  ctx.res.person.films = [
    { title: 'Her', producers: ['Annapurna'] },
    { title: 'Adaptation', producers: ['Kaufman'] }
  ]
  return next()
})

// Mount schema to express
app.use('/', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
app.listen(3000, () => console.log('listening on 3000'))
