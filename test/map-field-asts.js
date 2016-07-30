const { describe, it } = global // For linting
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
          world: string()
        })
      }),
      `{
        hello {
          world
        }
      }`
    )
    query.hello.fields.world.fields.should.be.empty()
  })

  xit('validates arguments', () => {
    (() => getQuery(
      object({
        person: object({ name: string() }).meta({
          args: {
            name: string(),
            age: number().min(0).max(100)
          }
        })
      }),
      `{
        person(age: 0) {
          name
        }
      }`
    )).should.throw()
  })
})
