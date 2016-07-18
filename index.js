const {
  GraphQLSchema,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLUnionType,
  graphql
} = require('graphql')
const {
  uniqueId,
  map,
  find,
  mapValues,
  capitalize,
  keys,
  isEqual
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
  const ObjectType = isInput ? GraphQLInputObjectType : GraphQLObjectType
  switch (desc.type) {
    case 'number':
      const isInteger = !!find(desc.rules, { name: 'integer' })
      return isInteger ? GraphQLInt : GraphQLFloat
    case 'date':
    case 'string':
      return GraphQLString
    case 'object':
      if (cachedTypes[typeName]) {
        return cachedTypes[typeName]
      } else {
        const type = new ObjectType({
          name: typeName,
          fields: descsToSchema(desc.children)
        })
        cachedTypes[typeName] = type
        return type
      }
    case 'array':
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
}

const descsToSchema = (descs, done) => {
  const query = {}
  return mapValues(descs, (desc, key) => ({
    type: descToType(desc),
    args: descToArgs(desc) || {},
    description: desc.description || '',
    resolve: (parent, opts, root) => {
      validateArgs(desc, opts)
      if (!parent) {
        console.log('parent')
        query[key] = { args: opts, fields: {} }
        return new Promise((resolve) => setTimeout(() => {
          console.log('resolve')
          return resolve(done(query))
        }))
      } else {
        if (key === 'footerArticles') console.log('not', key, parent[key])
        return parent[key]
      }
    }
  }))
}
// query.article.args => { id: 1 }
// query.article.fields.footerArticles.args => { limit: 100 }

// -----------------------------------------------------------------------------
// Not included in the library
// -----------------------------------------------------------------------------

const { object, string, number, array } = require('joi')

let Article = {
  id: number(),
  title: string(),
  author: object({
    name: string(),
    bio: string()
  }),
  sections: array().items(
    object({
      type: string().valid('image'),
      src: string()
    }).meta({ name: 'ImageSection' }),
    object({
      type: string().valid('text'),
      body: string()
    }).meta({ name: 'TextSection' })
  )
}
Article.footerArticles = array().items(Article).meta({
  name: 'FooterArticles',
  args: { limit: number().integer().max(100) }
})
Article = object(Article).meta({
  name: 'Article',
  args: { id: number().max(10) }
})

const article = {
  id: 1,
  title: 'Foo',
  author: {
    name: 'Craig',
    bio: 'Da Best'
  },
  sections: [
    { type: 'text', body: 'Hello' },
    { type: 'image', src: 'foo.jpg' }
  ]
}
article.footerArticles = [article]

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: descsToSchema({
      article: Article.describe()
    }, (query) => {
      console.log('QUERY', query)
      return article
    })
  })
})

const query = `{
  article(id: 1) {
    id
    title
    author {
      name
      bio
    }
    sections {
      ... on ImageSection {
        type
        src
      }
      ... on TextSection {
        type
        body
      }
    }
    footerArticles(limit: 100) {
      id
    }
  }
}`

graphql(schema, query).then((r) => console.log('RES', r))
