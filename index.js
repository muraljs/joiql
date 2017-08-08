//
// Takes an object of { key: JoiSchema } pairs to generate a GraphQL Schema.
//
const Joi = require('joi')
const {
  uniqueId,
  map,
  find,
  capitalize,
  flatten,
  isEmpty,
  mapValues,
  omitBy,
  isNull,
  fromPairs,
  compact,
  last
} = require('lodash')
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLUnionType,
  GraphQLBoolean,
  GraphQLNonNull
} = require('graphql')

// Convenience helpers to determine a Joi schema's
// "presence", e.g. required or forbidden
const presence = (desc, name) =>
  desc.flags &&
  desc.flags.presence &&
  desc.flags.presence === name

// Cache converted types by their `meta({ name: '' })` property so we
// don't end up with a litter of anonymously generated GraphQL types
const cachedTypes = {}

// Maps a Joi description to a GraphQL type. `isInput` is used to determine
// when to use, say, GraphQLInputObjectType vs. GraphQLObjectType—useful in
// cases such as args and mutations.
const descToType = (schema, isInput) => {
  let desc = (schema && schema.describe ? schema.describe() : schema)
  let typeName = getTypeName(schema, isInput)
  let required = isInput && presence(desc, 'required')
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
          fields: () => omitBy(mapValues(desc.children, (child, k) => {
            if (presence(child, 'forbidden')) return null
            return { type: descToType(Joi.reach(schema, k), true) }
          }), isNull)
        })
      } else {
        type = new GraphQLObjectType({
          name: typeName,
          description: desc.description,
          fields: () => descsToFields(mapValues(desc.children, (child, k) => Joi.reach(schema, k)), isInput)
        })
      }
      cachedTypes[typeName] = type
      return type
    },
    array: () => {
      let type
      const items = schema._inner.items.filter((item) => !presence(item.describe(), 'forbidden'))
      if (items.length === 1) {
        type = descToType(items[0], isInput)
      } else {
        type = makeArrayAlternativeType(cachedTypes, isInput, typeName, desc, items)
      }
      if (!cachedTypes[typeName]) cachedTypes[typeName] = type
      return new GraphQLList(type)
    },
    alternatives: () => {
      let type
      const alternatives = map(schema._inner.matches, 'schema')
        .filter((a) => !presence(a.describe(), 'forbidden'))
      type = makeArrayAlternativeType(cachedTypes, isInput, typeName, desc, alternatives)
      if (!cachedTypes[typeName]) cachedTypes[typeName] = type
      return type
    },
    lazy: () => descToType(schema._flags.lazy(), isInput)
  }[desc.type]()

  return required ? new GraphQLNonNull(type) : type
}

const makeArrayAlternativeType = (cachedTypes, isInput, typeName, desc, items) => {
  const types = items.map((item) => descToType(item, isInput))
  if (cachedTypes[typeName]) {
    return cachedTypes[typeName]
  } else if (isInput) {
    const children = fromPairs(flatten(items.map((item) => map(item._inner.children, (c) => [c.key, c.schema]))))
    const fields = descsToFields(children, isInput)
    return new GraphQLInputObjectType({
      name: typeName,
      description: desc.description,
      fields: fields
    })
  } else {
    return new GraphQLUnionType({
      name: typeName,
      description: desc.description,
      types: types,
      resolveType: (val) =>
        find(map(items, (item, i) => {
          try {
            return Joi.attempt(val, item)
          } catch (e) {}
        }))
    })
  }
}

// Convert a Joi description's `meta({ args: {} })` to a GraphQL field's
// arguments
const descToArgs = (schema) => {
  const argsSchema = getMeta(schema, 'args')
  return argsSchema && omitBy(mapValues(argsSchema, (schema) => {
    if (presence(schema.describe(), 'forbidden')) return null
    return {
      type: descToType(schema, true)
    }
  }), isNull)
}

// Wraps a resolve function specifid in a Joi schema to add validation.
const validatedResolve = (schema) => (source, args, root, opts) => {
  const desc = schema.describe()
  const resolve = desc.meta && getMeta(schema, 'resolve')
  if (args && !isEmpty(args)) {
    const argsSchema = getMeta(schema, 'args')
    const value = Joi.attempt(args, argsSchema)
    return resolve(source, value, root, opts)
  }
  if (resolve) return resolve(source, args, root, opts)
  else return source && source[opts.fieldASTs[0].name.value]
}

// Convert a hash of descriptions into an object appropriate to put in a
// GraphQL.js `fields` key.
const descsToFields = (schemas, isInput) =>
  omitBy(mapValues(schemas, (schema) => {
    const desc = (schema && schema.describe ? schema.describe() : schema)
    const cleanSchema = clean(schema)
    if (presence(desc, 'forbidden')) return null
    return {
      type: descToType(cleanSchema, isInput),
      args: descToArgs(cleanSchema, isInput),
      description: desc.description || '',
      resolve: validatedResolve(cleanSchema)
    }
  }), isNull)

// Converts the { key: JoiSchema } pairs to a GraphQL.js schema object
module.exports = (jois) => {
  const attrs = {}
  if (jois.query) {
    attrs.query = new GraphQLObjectType({
      name: 'RootQueryType',
      fields: descsToFields(jois.query)
    })
  }
  if (jois.mutation) {
    attrs.mutation = new GraphQLObjectType({
      name: 'RootMutationType',
      fields: descsToFields(jois.mutation)
    })
  }
  return new GraphQLSchema(attrs)
}

const clean = (schema) => {
  const desc = schema.describe()
  switch (desc.type) {
    case 'lazy':
      return clean(schema._flags.lazy())
  }

  return schema
}

const getTypeName = (schema, isInput) => {
  schema = clean(schema)
  const desc = schema.describe()
  let typeName = getMeta(schema, 'typeName')

  if (!typeName) {
    switch (desc.type) {
      case 'array':
        const items = schema._inner.items.filter((item) => !presence(item.describe(), 'forbidden'))

        if (items.length > 1) {
          typeName = map(items, (fieldSchema) => {
            const d = fieldSchema.describe()
            const name = (
              getMeta(fieldSchema, 'name') ||
              capitalize(d.type) ||
              'Anon' + uniqueId()
            )
            return (isInput ? 'Input' : '') + name
          }).join('Or')
        }
        break
    }

    if (!typeName) {
      typeName = (
        (isInput ? 'Input' : '') +
        (getMeta(schema, 'name') || capitalize(desc.type) + uniqueId())
      )
    }

    schema._meta.push({ typeName: typeName })
  }

  return typeName
}

const getMeta = (schema, key) => {
  const desc = schema.describe()

  return last(compact(map(desc.meta, key)))
}
