const Joi = require('joi')
const {
  GraphQLSchema,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  graphql
} = require('graphql')
const {
  uniqueId,
  map,
  find,
  assign,
  mapValues
} = require('lodash')

const joiTypes = {}

const joiDescToGraphQLType = (desc, isInput) => {
  let typeName = (
    (isInput ? 'Input' : '') +
    (map(desc.meta, 'name')[0] || 'WarningUnknownType' + uniqueId())
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
        const fields = {}
        typeName = map(desc.items, (item) =>
          (isInput ? 'Input' : '') +
          (map(item.meta, 'name')[0] || 'WarningUnknownType' + uniqueId())
        ).join('And')
        if (joiTypes[typeName]) {
          type = joiTypes[typeName]
        } else {
          desc.items.forEach((item) => {
            const itemFields = mapValues(desc.children, (desc) =>
              ({ type: joiDescToGraphQLType(desc, isInput) }))
            assign(fields, itemFields)
          })
          type = new ObjectType({
            name: typeName,
            description: desc.description,
            fields: fields
          })
        }
      }
      if (!joiTypes[typeName]) joiTypes[typeName] = type
      return new GraphQLList(type)
  }
}

// const schema = Joi.object().keys({
//   username: Joi.string().alphanum().min(3).max(30).required(),
//   password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/),
//   access_token: [Joi.string(), Joi.number()],
//   birthyear: Joi.number().integer().min(1900).max(2013),
//   email: Joi.string().email()
// }).with('username', 'birthyear').without('password', 'access_token')

const foo = ({
  id: Joi.string()
}, Joi.object().keys({
  title: Joi.string(),
  author: Joi.object().keys({
    name: Joi.string(),
    email: Joi.string()
  })
}).meta({ name: 'Hello' })

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      h: {
        args: ,
        type: joiDescToGraphQLType(Joi.object().keys({
          hello: Joi.string(),
          world: Joi.string()
        }).meta({ name: 'Hello' }).describe(), false),
        resolve: (root, opts) => {
          console.log('moo', root)
          return { hello: '', world: '' }
        }
      }
    }
  })
})

graphql(schema, '{ h { hello world } }').then(console.log.bind(console))
