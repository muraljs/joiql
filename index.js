const {
  GraphQLSchema,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInterfaceType,
  graphql
} = require('graphql')
const {
  uniqueId,
  map,
  find,
  mapValues,
  capitalize
} = require('lodash')

const joiTypes = {}

const joiDescToGraphQLType = (desc, isInput) => {
  let typeName = (
    (isInput ? 'Input' : '') +
    (map(desc.meta, 'name')[0] || 'Anon' + uniqueId())
  )
  const ObjectType = isInput ? GraphQLInputObjectType : GraphQLObjectType
  switch (desc.type) {
    case 'number':
      const isInteger = !!find(desc.rules, { name: 'integer' })
      return isInteger ? GraphQLInt : GraphQLFloat
    case 'date':
    case 'string':
      return GraphQLString
    case 'object':
      if (joiTypes[typeName]) {
        return joiTypes[typeName]
      } else {
        const type = new ObjectType({
          name: typeName,
          description: desc.description,
          fields: mapValues(desc.children, (desc) =>
            ({ type: joiDescToGraphQLType(desc, isInput) }))
        })
        joiTypes[typeName] = type
        return type
      }
    case 'array':
      let type
      if (desc.items.length === 1) {
        type = joiDescToGraphQLType(desc.items[0], isInput)
      } else {
        typeName = map(desc.items, (d) =>
          (isInput ? 'Input' : '') + capitalize(d.type) || 'Anon' + uniqueId()
        ).join('Or')
        if (joiTypes[typeName]) {
          type = joiTypes[typeName]
        } else {
          type = new GraphQLInterfaceType({
            name: typeName,
            description: desc.description,
            types: desc.items.map((d) =>
              joiDescToGraphQLType(d, isInput)),
            resolveType: (val) => {
              console.log('moo', val)
              return true
            }
          })
        }
      }
      if (!joiTypes[typeName]) joiTypes[typeName] = type
      return new GraphQLList(type)
  }
}

const { object, string, number, array } = require('joi')

const Article = object({
  id: number(),
  title: string(),
  author: object({
    name: string(),
    bio: string()
  }),
  votes: array().items(
    object({ foo: string() }),
    object({ bar: string() })
  )
  // sections: array().items(
  //   object({
  //     type: string().valid('image'),
  //     src: string()
  //   }),
  //   object({
  //     type: string().valid('text'),
  //     body: string()
  //   })
  // )
  // footerArticles: {
  //   args: { limit: number().integer().max(100) },
  //   fields: array().items(Article)
  // }
})

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      article: {
        args: {},
        type: joiDescToGraphQLType(Article.describe(), false),
        resolve: (root, opts) => {
          console.log('moo', root, opts)
          return {
            id: 1,
            title: 'Wont believe',
            author: {
              name: 'Craig'
            },
            votes: [{ foo: 'bar' }]
          }
        }
      }
    }
  })
})

graphql(schema, '{ article { id votes { foo } } }')
  .then((r) => console.log('moo', JSON.stringify(r)))
