const joiql = require('../')
const { object, string, number, array, date } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')

const Film = object({
  title: string(),
  producers: array().items(string()),
  // TODO: Circular dependencies
  // characters: array().items(Person).meta({
  //   args: { limit: number().integer() }
  // }),
  release_date: date()
})

const Person = object({
  name: string(),
  films: array().items(Film)
}).meta({
  args: { id: number().required() }
})

const api = joiql({
  query: {
    person: Person,
    film: Film
  }
})

api.on('query.film', (_, res) => {
  res.film = { title: 'bar' }
})
api.on('query.person', (_, res) => {
  res.person = { name: 'Spike Jonze' }
})
api.on('query.person.fields.films', (_, res) => {
  res.person.films = [
    { title: 'Her', producers: ['Annapurna'] },
    { title: 'Adaptation', producers: ['Kaufman'] }
  ]
})

app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))

app.listen(3000, () => console.log('listening on 3000'))
