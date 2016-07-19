# joiql

WIP to generate a GraphQL schema from a Joi schema.

## Example

````javascript
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
joiql({
  person: Person,
  film: Film
}, `{
  person(id: 1) {
    name
    films {
      title
      producers
    }
  }
}`, (query) => {
  const res = {}
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
}).then((result) => {
  console.log(result)
})
````