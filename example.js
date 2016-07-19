const joiql = require('./')
const { graphql } = require('graphql')
const { object, string, number, array, date } = require('joi')

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
    if (query.person.fields.films) res.person.films = [
      { title: 'Her', producers: ['Annapurna'] },
      { title: 'Adaptation', producers: ['Kaufman'] }
    ]
  }
  return res
})

graphql(schema, `{
  film {
    title
  }
  person(id: 1) {
    name
    films {
      title
      producers
    }
  }
}`).then((r) => console.log('RES', r))
