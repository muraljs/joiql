//
// Takes an object of { key: JoiSchema } pairs, along with a stack of
// middleware functions, to generate a GraphQL Schema that resolves through the
// stack of middleware all at once, instead of in the nested way that GraphQL.js
// encourages by default.
//
const { GraphQLSchema, GraphQLObjectType } = require('graphql')
const { mapValues } = require('lodash')
const { addRoute, buildMiddlewares } = require('./lib/middleware')
const descsToFields = require('./lib/descs-to-fields')

// Converts the { key: JoiSchema } pairs to a GraphQL.js schema object
const joiSchemasToGraphQLSchema = (jois, resolveMiddlewares) => {
  const attrs = {}
  if (jois.query) {
    attrs.query = new GraphQLObjectType({
      name: 'RootQueryType',
      fields: descsToFields(
        mapValues(jois.query, (j) => j.describe()),
        (mappedQuery) => resolveMiddlewares({ query: mappedQuery })
      )
    })
  }
  if (jois.mutation) {
    attrs.mutation = new GraphQLObjectType({
      name: 'RootMutationType',
      fields: descsToFields(
        mapValues(jois.mutation, (j) => j.describe()),
        (mappedQuery) => resolveMiddlewares({ mutation: mappedQuery })
      )
    })
  }
  return new GraphQLSchema(attrs)
}

// Generates the JoiQL library API that returns the GraphQL.js schema and
// provides an `.on` API for mounting resolve middlewares
module.exports = (jois) => {
  const middleware = []
  const schema = joiSchemasToGraphQLSchema(jois, buildMiddlewares(middleware))
  return { schema, on: addRoute(middleware) }
}
