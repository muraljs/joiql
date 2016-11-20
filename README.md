# joiql

Make [GraphQL](http://graphql.org/) schema creation and data validation easy with [Joi](https://github.com/hapijs/joi).

## Example

Run this using `npm run example examples/films`...

````javascript
const joiql = require('../')
const { object, string, number, array, date } = require('joi')
const app = require('express')()
const graphqlHTTP = require('express-graphql')

// Joi Schemas
const Film = object({
  title: string(),
  producers: array().items(string()),
  releaseDate: date()
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

// Koa 2 style middleware to resolve the request
// (using promises in anticipation of async/await)
api.use((ctx, next) => {
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
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
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

Unlike GraphQL.js, JoiQL resolves schemas all at once through [Koa 2](https://github.com/koajs/koa)-like middleware at the root level. This has a number of exciting benefits for resuability, composability, pluggability, and other abstract design pattern stuff like that which is yet to be fully explored/explained. Peruse some stuff in /examples to see how we use middleware to elegantly add things like logging, caching, automatic GraphQL query to REST/Database call conversion, etc.

Middleware functions resolve in the same way Koa 2 middleware does. Calling `next` will pass control to the next middleware function and `await` the rest of the downstream middleware code to finish. Once the downstream middleware code is finished, control flows back upstream resolving the `await`ed middleware code.

Finally notice how we mutate `ctx.res`. This is how you resolve queries in JoiQL—the `ctx.res` object represents the final data blob being returned from the GraphQL query. Each middleware builds up the `ctx.res` object which gets sent as the GraphQL JSON response after all the middlewares resolve.

````javascript
api.use(async (ctx, next) => {
  const start = new Date()
  await next()
  const ms = new Date - start
  console.log(`Request took ${ms}`)
})
api.use(async (ctx) => {
  ctx.res.person = await Person.findOne({ id: ctx.req.query.person.id })
})
````

## API

### ctx.req

An object representing the parsed GraphQL query, For instance a query like...

```
mutation {
  artwork(
    title: "Skull"
    date: "1976-02-01T05:00:00.000Z"
  ) {
    title
  }
}
```

Would be parsed into an object that looks like

```
{
  mutation: {
    artwork: {
      args: {
        title: "Skull",
        date: "1976-02-01T05:00:00.000Z"
      },
      fields: {
        title: { args: {}, fields {} }
      }
    }
  }
}
```

### ctx.res

An object passed through middleware used to build up the final response.

### ctx.state

The recommended namespace for passing information through middleware.

## Examples

Right now the /examples folder contains a playground of ideas being explored. To get set up install node modules `npm i` and use `npm run example examples/app` to boot up a GraphQL server mounting JoiQL schemas.

The ./examples/app folder shows a basic example of how one can quickly build a full database backed API with minimal boilerplate using JoiQL. Try copy/pasting the `article` or `vertical` schema into a new resource to see how quickly one can add full, validated, CRUD operations to a new resource. `db.js` is a set of middleware that introspects the full GraphQL query and converts it to database operations (using a fake db in memory—but you can imagine how easy it would be to replace that with real database operations on a PostgreSQL or Mongo).

## TODO

* Figure out how to do circular dependencies (ideally with Joi `lazy`)
* Better errors (right now one error batches up the same response for every query)

## Contributing

Please fork the project and submit a pull request with tests. Install node modules `npm install` and run tests with `npm test`.

## License

MIT
