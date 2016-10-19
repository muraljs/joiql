/* eslint-env mocha */
const mapFieldASTs = require('../lib/map-field-asts')
const { string, number, object } = require('joi')
const { parse } = require('graphql/language')

const getQuery = (schema, query) => {
  const ast = parse(query)
  const selections = ast.definitions[0].selectionSet.selections
  return mapFieldASTs(schema.describe(), selections)
}

describe('mapFieldASTs', () => {
  it('converts a parsed GraphQL query into a nice object', () => {
    const query = getQuery(
      object({
        hello: object({
          world: string(),
          metadata: object({
            email: string(),
            name: string()
          })
        })
      }),
      `{
        hello {
          world
          metadata {
            email
            name
          }
        }
      }`
    )
    query.hello.fields.world.fields.should.be.empty()
    query.hello.fields.metadata.fields.email.fields.should.be.empty()
    query.hello.fields.metadata.fields.name.fields.should.be.empty()
  })

  xit('validates arguments', () => {
    (() => getQuery(
      object({
        person: object({ name: string() }).meta({
          args: { age: number().min(1).max(100) }
        })
      }),
      `{
        person(age: 0) {
          name
        }
      }`
    )).should.throw()
  })

  xit('doesnt choke when missing a description')
})
