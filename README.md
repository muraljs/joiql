# joiql

**NOTE: This is a WIP and not production ready yet**

Make [GraphQL](http://graphql.org/) schema creation and data validation easy with [Joi](https://github.com/hapijs/joi).

## Example

Run this using `npm run example examples/films`...

````javascript
const { object, string, number, array, date } = require('joi')
const joiql = require('../')

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
  ctx.res.film = { title: 'Paul Blart Mall Cop' }
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

// Use the GraphQL.js schema object to mount in say Express
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
````

## Breaking it down

Define some schemas using [Joi](https://github.com/hapijs/joi).

````javascript
const { object, string, number, array, date } = require('joi')

const Film = object({
  title: string(),
  producers: array().items(string()),
  release_date: date()
})

const Person = object({
  name: string(),
  films: array().items(Film)
})
// `meta.args` on Joi schemas define GraphQL arguments (adding automatic
// input validation), and the `meta.name` property is used to declare the custom
// GraphQLObjectType name. When `name` is undefined JoiQL will automatically
// add an "Anonymous<UID>" type name).
.meta({
  name: 'Person',
  args: { id: number().required() }
})
````

Create your JoiQL `api` object from the Joi schemas and expose a GraphQL.js schema object for mounting into a server like Express.

````javascript
const { graphql } = require('graphql')
const joiql = require('../')

const api = joiql({
  query: {
    person: Person,
    film: Film
  }
})

graphql(api.schema, `{ person(id: 1) { name } }`).then(() => {})
````

Unlike GraphQL.js, JoiQL resolves schemas all at once through middleware at the root level—using dot notation "routing" to scope granular resolves to properties. This has a number of exciting benefits for resuability, composability, pluggability, and other abstract design pattern stuff like that which is yet to be fully explored/explained. Peruse some stuff in /examples to see how we use middleware to elegantly add things like logging, caching, automagic query to REST/Database call conversion, etc.

The below code shows how we use dot notation "routes" to scope our resolves to properties on a given GraphQL query. For instance `on('query.film')` will run the middleware callback if someone sends a `query { film { ... } }` GraphQL query, and skips that middleware if someone queries say `query { person { ... } }` (without `film`). The middleware functions must return a promise (in anticipation of async/await support) and will execute in the order they are `.on`ed (awaiting the previous promise). Finally notice how we mutate `ctx.res` in each middleware. This is how you resolve queries in JoiQL—the `ctx.res` object represents the final data blob being returned from the GraphQL query. Each middleware builds up the `ctx.res` object which gets sent as the GraphQL JSON response after all the middlewares resolve.

````javascript

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
````

### Examples

Right now the /examples folder contains a playground of ideas being explored. To get set up install node modules `npm i` and use `npm run example examples/app` to boot up a GraphQL server mounting JoiQL schemas.

The ./examples/app folder shows a basic example of how one can quickly build a full database backed API with minimal boilerplate using JoiQL. Try copy/pasting the `article` or `vertical` schema into a new resource to see how quickly one can add full, validated, CRUD operations to a new resource. `db.js` is a set of middleware that introspects the full GraphQL query and converts it to database operations (using a fake db in memory—but you can imagine how easy it would be to replace that with real database operations on a PostgreSQL or Mongo).

The ./examples/artsy folder is quick attempt at replicating behavior of Artsy's GraphQL API [Metaphysics](https://github.com/artsy/metaphysics). You will need to copy `.env.example` to a `.env` file filling in the missing environment variables to run this. Notice how we use middleware to generically convert schemas to REST requests sent to Arty's API and how we use caching middleware to elegantly cache aggregated responses without the need for [DataLoader](https://github.com/facebook/dataloader) trickery.

## TODO

* Middleware design still needs work... consider bi-direction using `next` like Koa, also maybe "immutable" return `res` object Redux-style instead?
* Figure out how to do circular dependencies (ideally with Joi `lazy`)
* Better errors (right now one error batches up the same response for every query)
