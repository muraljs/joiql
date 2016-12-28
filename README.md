# joiql

Make [GraphQL](http://graphql.org/) schema creation and data validation easy with [Joi](https://github.com/hapijs/joi).

## Example

Run this using `node example`...

````javascript
const joiql = require('joiql')
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
  args: { id: number().required() },
  resolve: (root, args, req, ast) => ({ name: 'Spike Jonze' })
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
````

## Breaking it down

First, define some schemas using [Joi](https://github.com/hapijs/joi).

````javascript
const { object, string, number, array, date } = require('joi')

const Film = object({
  title: string(),
  producers: array().items(string()),
  releaseDate: date()
})

const Person = object({
  name: string(),
  films: array().items(Film)
})
````

JoiQL uses the [`meta` property](https://github.com/hapijs/joi/blob/v9.0.4/API.md#anymetameta) to extend GraphQL fields. Use `meta.args` to define GraphQL arguments (adding automatic
input validation), and `meta.name` to declare the `GraphQLObjectType` type name (without it JoiQL will automatically
add a "Anon<UID>" type name).

````javascript
Person.meta({
  name: 'Person',
  args: { id: number().required() }
})
````

Then create a JoiQL `api` object from the Joi schemas and expose a GraphQL.js schema object for mounting into a server like Express.

````javascript
const { graphql } = require('graphql')
const joiql = require('../')

const api = joiql({
  query: {
    person: Person,
    film: Film
  }
})

graphql(api.schema, ...)
````

## TODO

* Figure out how to do circular dependencies (ideally with Joi `lazy`)

## Contributing

Please fork the project and submit a pull request with tests. Install node modules `npm install` and run tests with `npm test`.

## License

MIT
