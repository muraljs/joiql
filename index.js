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
  assign,
  compact
} = require('lodash')
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
  const aggregate = debounce(() => { res = done(query) })
  return mapValues(descs, (desc, key) => ({
    type: descToType(desc),
    args: descToArgs(desc) || {},
    description: desc.description || '',
    resolve: (source, args, root, { fieldASTs }) => {
      assign(query, mapSelection(fieldASTs))
      validateArgs(desc, args)
      aggregate()
      if (!source) {
        return new Promise((resolve, reject) => setTimeout(() => {
          if (res.then) res.then((res) => resolve(res[key])).catch(reject)
          else try { resolve(res[key]) } catch (e) { reject(e) }
        }))
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

const schemaResolve = (jois, done) => {
  const attrs = {}
  if (jois.query) {
    attrs.query = new GraphQLObjectType({
      name: 'RootQueryType',
      fields: descsToSchema(mapValues(jois.query, (j) =>
        j.describe()), (res) => done({ query: res }))
    })
  }
  if (jois.mutation) {
    attrs.mutation = new GraphQLObjectType({
      name: 'RootMutationType',
      fields: descsToSchema(mapValues(jois.mutation, (j) =>
        j.describe()), (res) => done({ mutation: res }))
    })
  }
  return new GraphQLSchema(attrs)
}

module.exports = (jois) => {
  const resolvers = []
  const res = {}
  const schema = schemaResolve(jois, (gqlQuery) => {
    const promises = resolvers.map(({ prop, resolve: done }) => {
      const req = prop.split('.').reduce((a, b) => a && a[b], gqlQuery)
      if (req) return () => done({ req, res })
      else return () => Promise.resolve()
    })
    return compact(promises)
      .reduce((prev, cur) =>
        typeof prev === 'function' ? prev().then(cur) : prev.then(cur)
      )
      .then(() => res)
  })
  const api = {
    schema: schema,
    on: (prop, resolve) => {
      resolvers.push({ prop, resolve })
      return api
    }
  }
  return api
}
