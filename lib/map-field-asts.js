//
// Converts, and validates using Joi, a parsed GraphQL query (via the GraphQL.js
// AST object), into something easier to traverse and inspect.
//
// e.g. A query like this...
//
// {
//   artist(id: "andy-warhol") {
//     name
//     artworks(limit: 100) {
//       title
//     }
//   }
// }
//
// Would be validated and parsed into...
//
// {
//   artist: {
//     args: { id: 'andy-warhol' },
//     fields: {
//       artworks: {
//         args: { limit: 100 },
//         fields: { title: {} }
//       }
//     }
//   }
// }
//
const { map, uniq, assign } = require('lodash')
const Joi = require('joi')

// Run the parsed args object through Joi for automatic input validation
const validateArgs = (desc, args) => {
  if (!desc) return {}
  const argsSchema = map(desc.meta, 'args')[0]
  if (!argsSchema) return {}
  const { value, error } = Joi.validate(args, argsSchema)
  if (error) throw error
  return value
}

// Converts a GraphQL AST "selection" into the easier-to-traverse value
// described above.
const selectionToValue = (selection) => {
  const fns = {
    IntValue: () => selection.value,
    StringValue: () => selection.value,
    BooleanValue: () => selection.value,
    ListValue: () => map(selection.values, selectionToValue),
    ObjectValue: () => assign(...map(selection.fields, (field) =>
      ({ [field.name.value]: selectionToValue(field.value) })))
  }
  if (!fns[selection.kind]) {
    throw new Error(`Unsupported kind ${selection.kind}`)
  }
  return fns[selection.kind]()
}

// Recursively traverses a `fieldASTs` object from GraphQL.js and outputs
// the easier-to-traverse object described above.
const mapFieldASTs = (desc, selections) => {
  const kinds = uniq(map(selections, 'kind')).join('')
  if (kinds === 'InlineFragment') {
    return selections.map((s) => mapFieldASTs(desc, s.selectionSet.selections))
  }
  const mapped = assign(...map(selections, (selection) => {
    const key = selection.name.value
    const args = validateArgs(desc, assign(...map(selection.arguments, (arg) =>
      ({ [arg.name.value]: selectionToValue(arg.value) }))))
    const fields = selection.selectionSet
      ? mapFieldASTs(desc.children, selection.selectionSet.selections)
      : {}
    return { [key]: { args, fields } }
  }))
  return mapped
}

module.exports = mapFieldASTs
