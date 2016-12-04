//
// Takes an object of { key: JoiSchema } pairs to generate a GraphQL Schema.
//
const { GraphQLSchema, GraphQLObjectType } = require('graphql')
const { mapValues } = require('lodash')
const Joi = require('joi')
const {
  uniqueId,
  map,
  find,
  capitalize,
  keys,
  isEqual,
  assign,
  flatten,
  isEmpty
} = require('lodash')
const {
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLUnionType,
  GraphQLBoolean,
  GraphQLNonNull
} = require('graphql')

// Cache converted types by their `meta({ name: '' })` property so we
// don't end up with a litter of anonymously generated GraphQL types
const cachedTypes = {}

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
    },
    alternatives: () => {
      let type
      if (cachedTypes[typeName]) return cachedTypes[typeName]
      const types = desc.alternatives.map((item) =>
        descToType(item, isInput))
      const children = desc.alternatives.map((item) => item.children)
      const fields = descsToFields(assign(...flatten(children)))
      if (isInput) {
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
          resolveType: (val) =>
            find(map(desc.alternatives, (item, i) => {
              const isTypeOf = map(item.meta, 'isTypeOf')[0]
              if (isTypeOf) return isTypeOf(val) && types[i]
              // TODO: Should use JOI.validate(), just looks at matching keys
              // We might need to pass schema here instead
              else return isEqual(keys(val), keys(item.children)) && types[i]
            }))
        })
      }
      cachedTypes[typeName] = type
      return type
    }
  }[desc.type]()
  return required ? new GraphQLNonNull(type) : type
}

// Convert a Joi description's `meta({ args: {} })` to a GraphQL field's
// arguments
const descToArgs = (desc) => {
  const argsSchema = map(desc.meta, 'args')[0]
  return argsSchema && mapValues(argsSchema, (schema) => ({
    type: descToType(schema.describe(), true)
  }))
}

// Wraps a resolve function specifid in a Joi schema to add validation.
const validatedResolve = (desc) => (source, args, root, opts) => {
  if (args && !isEmpty(args)) {
    const resolve = desc.meta && desc.meta[0].resolve
    const argsSchema = map(desc.meta, 'args')[0]
    const { value, error } = Joi.validate(args, argsSchema)
    if (error) throw error
    return resolve(source, value, root, opts)
  }
  return source[opts.fieldASTs[0].name.value]
}

// Convert a hash of descriptions into an object appropriate to put in a
// GraphQL.js `fields` key.
const descsToFields = (descs, resolveMiddlewares = () => {}) =>
  mapValues(descs, (desc) => ({
    type: descToType(desc),
    args: descToArgs(desc),
    description: desc.description || '',
    resolve: validatedResolve(desc)
  }))

// Converts the { key: JoiSchema } pairs to a GraphQL.js schema object
module.exports = (jois) => {
  const attrs = {}
  if (jois.query) {
    attrs.query = new GraphQLObjectType({
      name: 'RootQueryType',
      fields: descsToFields(mapValues(jois.query, (j) => j.describe()))
    })
  }
  if (jois.mutation) {
    attrs.mutation = new GraphQLObjectType({
      name: 'RootMutationType',
      fields: descsToFields(mapValues(jois.mutation, (j) => j.describe()))
    })
  }
  return new GraphQLSchema(attrs)
}
