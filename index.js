const {
  GraphQLSchema,
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
const {
  uniqueId,
  map,
  fromPairs,
  find,
  mapValues,
  capitalize,
  keys,
  isEqual,
  uniq,
  debounce,
  assign
} = require('lodash')
const { parse } = require('graphql')
const Joi = require('joi')

const cachedTypes = {}

const validateArgs = (desc, args) => {
  const argsSchema = map(desc.meta, 'args')[0]
  if (!argsSchema) return {}
  const { data, error } = Joi.validate(args, argsSchema)
  if (error) throw error
  return data
}

const descToArgs = (desc) => {
  const argsSchema = map(desc.meta, 'args')[0]
  return argsSchema && mapValues(argsSchema, (schema) => ({
    type: descToType(schema.describe(), true)
  }))
}

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
      if (cachedTypes[typeName]) {
        return cachedTypes[typeName]
      } else {
        const ObjectType = isInput ? GraphQLInputObjectType : GraphQLObjectType
        const type = new ObjectType({
          name: typeName,
          fields: descsToSchema(desc.children)
        })
        cachedTypes[typeName] = type
        return type
      }
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
      if (!cachedTypes[typeName]) cachedTypes[typeName] = type
      return new GraphQLList(type)
    }
  }[desc.type]()
  return required ? new GraphQLNonNull(type) : type
}

const descsToSchema = (descs, done = () => {}) => {
  const query = {}
  let res
  const fin = debounce(() => { res = done(query) })
  return mapValues(descs, (desc, key) => ({
    type: descToType(desc),
    args: descToArgs(desc) || {},
    description: desc.description || '',
    resolve: (source, args, root, { fieldASTs }) => {
      assign(query, mapSelection(fieldASTs))
      validateArgs(desc, args)
      fin()
      if (!source) {
        return new Promise((resolve) => setTimeout(() => resolve(res[key])))
      } else return source[key]
    }
  }))
}

const mapSelection = (selections) => {
  const kinds = uniq(map(selections, 'kind')).join('')
  if (kinds === 'InlineFragment') {
    return selections.map((s) => mapSelection(s.selectionSet.selections))
  }
  return fromPairs(selections.map((selection) => {
    const key = selection.name.value
    const args = fromPairs(map(selection.arguments, (sel) =>
      [sel.name.value, sel.value.value]
    ))
    const fields = selection.selectionSet
      ? mapSelection(selection.selectionSet.selections)
      : {}
    return [key, { args, fields }]
  }))
}

module.exports = (jois, done) => {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'RootQueryType',
      fields: descsToSchema(mapValues(jois.query, (j) => j.describe()), done)
    }),
    mutation: new GraphQLObjectType({
      name: 'RootMutationType',
      fields: descsToSchema(mapValues(jois.mutation, (j) => j.describe()), done)
    })
  })
}
