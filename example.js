const joiql = require('./')
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

const schema = joiql({
  person: Person,
  film: Film
}, (query) => {
  const res = {}
  if (query.film) res.film = { title: 'bar' }
  if (query.person) {
    // db.people.find({ id: query.person.args.id })
    res.person = { name: 'Spike Jonze' }
    // db.films.find({ id: { $in: res.person.film_ids } })
    if (query.person.fields.films) {
      res.person.films = [
        { title: 'Her', producers: ['Annapurna'] },
        { title: 'Adaptation', producers: ['Kaufman'] }
      ]
    }
  }
  return res
})

app.use('/graphql', graphqlHTTP({
  schema: schema,
  graphiql: true
}))

app.listen(3000, () => console.log('listening on 3000'))
