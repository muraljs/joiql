/* eslint-env mocha */
const { string, number, object, date, array, alternatives, lazy } = require('joi')
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

let Person = object({
  id: string(),
  name: string(),
  birthday: date(),
  age: lazy(() => number().integer())
}).meta({
  args: { id: string().required(), age: number().min(1).max(100) },
  resolve: (source, args) => db[args.id]
})

const schema = joiql({
  query: {
    person: Person
  }
})

describe('joiql', () => {
  it('converts a Joi schema into GraphQL', () => {
    const query = '{ person(id: "hillary") { name } }'
    return graphql(schema, query).then((res) => {
      res.data.person.name.should.equal('Hillary Clinton')
    })
  })

  it('validates args', () => {
    const query = '{ person(age: 0 id: "hillary") { name } }'
    return graphql(schema, query).then((res) => {
      res.errors[0].message.should.containEql('{\n  "id": "hillary",\n  "age" \u001b[31m[1]\u001b[0m: 0\n}\n\u001b[31m\n[1] "age" must be larger than or equal to 1\u001b[0m')
    })
  })

  it('works without args', () => {
    const schema = joiql({
      query: {
        hello: string().meta({ resolve: () => 'world' })
      }
    })
    return graphql(schema, '{ hello }').then((res) => {
      res.data.hello.should.equal('world')
    })
  })

  it('works without args or resolves', () => {
    const schema = joiql({
      query: {
        hello: string()
      }
    })
    return graphql(schema, '{ hello }').then((res) => {
      (res.data.hello === null).should.be.ok()
      ;(typeof undefined).should.equal('undefined')
    })
  })

  it('omits forbidden fields', () => {
    const schema = joiql({
      query: {
        a: string().forbidden(),
        b: string(),
        c: object({
          d: string().forbidden(),
          e: string()
        }),
        f: array().items(object({
          g: string().forbidden(),
          h: string()
        })),
        j: array().items(
          object({ k: string() }),
          object({ l: string() }).forbidden()
        ),
        m: alternatives(
          object({ n: string() }).meta({ name: 'N' }),
          object({ o: string() }).meta({ name: 'O' }).forbidden()
        )
      }
    })
    return graphql(schema, '{ a c { d } f { g } j { k l } m { o } }')
      .then((res) => {
        const errs = res.errors.map((e) => e.message).join('')
        errs.should.containEql('Cannot query field "a"')
        errs.should.containEql('Cannot query field "d"')
        errs.should.containEql('Cannot query field "g"')
        errs.should.containEql('Cannot query field "l"')
        errs.should.containEql('Cannot query field "o"')
      })
      .then(() =>
        graphql(schema, '{ a b c { e } f { h } j { k } m ... on N { n } }')
      )
      .then((res) => {
        const errs = res.errors.map((e) => e.message).join('')
        errs.should.not.containEql('Cannot query field "b"')
        errs.should.not.containEql('Cannot query field "e"')
        errs.should.not.containEql('Cannot query field "h"')
        errs.should.not.containEql('Cannot query field "k"')
        errs.should.not.containEql('Cannot query field "n"')
      })
  })

  it('omits forbidden args', () => {
    const schema = joiql({
      query: {
        a: string().meta({
          args: {
            b: string().forbidden(),
            c: string(),
            d: object({
              e: string().forbidden(),
              f: string()
            }),
            g: array().items(object({
              h: string().forbidden(),
              i: string()
            })),
            j: array().items(
              object({ k: string() }),
              object({ l: string() }).forbidden()
            ),
            m: alternatives(
              object({ n: string() }).meta({ name: 'N' }),
              object({ o: string() }).meta({ name: 'O' }).forbidden()
            )
          }
        })
      }
    })
    return graphql(schema, `{
      a(
        b: "Foo"
        d: { e: "Foo" }
        g: { h: "Foo" }
        j: { l: "Foo" }
        m: { o: "Foo" }
      )
    }`).then((res) => {
      const errs = res.errors.map((e) => e.message).join('')
      errs.should.containEql('Unknown argument "b"')
      errs.should.containEql('has invalid value {e')
      errs.should.containEql('has invalid value {h')
      errs.should.containEql('has invalid value {l')
      errs.should.containEql('has invalid value {o')
    })
  })
})
