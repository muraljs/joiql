/* eslint-env mocha */
const { string, number, object, date } = require('joi')
const { graphql } = require('graphql')
const joiql = require('../')

const db = {
  hillary: {
    name: 'Hillary Clinton',
    age: 68,
    birthday: new Date(1947, 9, 26)
  },
  elizabeth: {
    name: 'Elizabeth Warren',
    age: 67,
    birthday: new Date(1949, 5, 22)
  }
}

const Person = object({
  id: string(),
  name: string(),
  birthday: date(),
  age: number().integer()
}).meta({
  args: { id: string().required(), age: number().min(1).max(100) }
})

const api = joiql({
  query: {
    person: Person
  }
})

api.use((ctx, next) => {
  ctx.res.person = db[ctx.req.query.person.args.id]
  return next()
})

describe('joiql', () => {
  it('converts a Joi schema and middleware into GraphQL', () => {
    const query = '{ person(id: "hillary") { name } }'
    return graphql(api.schema, query).then((res) => {
      res.data.person.name.should.equal('Hillary Clinton')
    })
  })

  it('validates args', () => {
    const query = '{ person(age: 0 id: "hillary") { name } }'
    return graphql(api.schema, query).then((res) => {
      res.errors[0].message.should.containEql('child "age" fails')
    })
  })
})
