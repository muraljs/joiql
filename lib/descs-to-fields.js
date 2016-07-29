//
// Convert a Joi description object into a single GraphQL schema object used
// when mounting into a server like Koa/Express or otherwise.
//
const {
  uniqueId,
  map,
  find,
  mapValues,
  capitalize,
  keys,
  isEqual,
  debounce,
  assign,
  flatten
} = require('lodash')
const {
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLUnionType,
  GraphQLBoolean,
  GraphQLNonNull
} = require('graphql')
const mapFieldASTs = require('./map-field-asts')

// Cache converted types by their `meta({ name: '' })` property so we
// don't end up with a litter of anonymously generated GraphQL types
const cachedTypes = {}

// Convert a Joi description's `meta({ args: {} })` to a GraphQL field's
// arguments
const descToArgs = (desc) => {
  const argsSchema = map(desc.meta, 'args')[0]
  return argsSchema && mapValues(argsSchema, (schema) => ({
    type: descToType(schema.describe(), true)
  }))
}

// Maps a Joi description to a GraphQL type. `isInput` is used to determine
// when to use, say, GraphQLInputObjectType vs. GraphQLObjectType—useful in
// cases such as args and mutations.
const descToType = (desc, isInput) => {
  let typeName = (
    (isInput ? 'Input' : '') +
    (map(desc.meta, 'name')[0] || 'Anon' + uniqueId())
  )
  const required = (
    isInput &&
    desc.flags &&
    desc.flags.presence &&
    desc.flags.presence === 'required'
  )
  const type = {
    boolean: () => GraphQLBoolean,
    date: () => GraphQLString,
    string: () => GraphQLString,
    number: () => {
      const isInteger = !!find(desc.rules, { name: 'integer' })
      return isInteger ? GraphQLInt : GraphQLFloat
    },
    object: () => {
      if (cachedTypes[typeName]) return cachedTypes[typeName]
      let type
      if (isInput) {
        type = new GraphQLInputObjectType({
          name: typeName,
          description: desc.description,
          fields: mapValues(desc.children, (child) => (
            { type: descToType(child, true) }))
        })
      } else {
        type = new GraphQLObjectType({
          name: typeName,
          description: desc.description,
          fields: descsToFields(desc.children)
        })
      }
      cachedTypes[typeName] = type
      return type
    },
    array: () => {
      let type
      if (desc.items.length === 1) {
        type = descToType(desc.items[0], isInput)
      } else {
        typeName = map(desc.items, (d) => {
          const name = (
            (d.meta && capitalize(d.meta.name)) ||
            capitalize(d.type) ||
            'Anon' + uniqueId()
          )
          return (isInput ? 'Input' : '') + name
        }).join('Or')
        if (cachedTypes[typeName]) {
          type = cachedTypes[typeName]
        } else {
          const types = desc.items.map((item) => descToType(item, isInput))
          if (isInput) {
            const children = desc.items.map((item) => item.children)
            const fields = descsToFields(assign(...flatten(children)))
            type = new GraphQLInputObjectType({
              name: typeName,
              description: desc.description,
              fields: fields
            })
          } else {
            type = new GraphQLUnionType({
              name: typeName,
              description: desc.description,
              types: types,
              // TODO: Should use JOI.validate(), just looks at matching keys
              // We might need to pass schema here instead
              resolveType: (val) =>
                find(map(desc.items, (item, i) =>
                  isEqual(keys(val), keys(item.children)) && types[i]))
            })
          }
        }
      }
      if (!cachedTypes[typeName]) cachedTypes[typeName] = type
      return new GraphQLList(type)
    }
  }[desc.type]()
  return required ? new GraphQLNonNull(type) : type
}

// Convert a hash of descriptions into an object appropriate to put in a
// GraphQL.js `fields` key.
const descsToFields = (descs, resolveMiddlewares = () => {}) => {
  const req = {}
  let finish
  const aggregate = debounce(() => { finish = resolveMiddlewares(req) })
  return mapValues(descs, (desc, key) => ({
    type: descToType(desc),
    args: descToArgs(desc),
    description: desc.description || '',
    resolve: (source, args, root, { fieldASTs }) => {
      assign(req, mapFieldASTs(desc, fieldASTs))
      aggregate()
      if (!source) {
        return new Promise((resolve, reject) => setTimeout(() => {
          finish.then((res) => resolve(res[key])).catch(reject)
        }))
      } else return source[key]
    }
  }))
}

module.exports = descsToFields
