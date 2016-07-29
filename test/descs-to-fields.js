const descsToFields = require('../lib/descs-to-fields')
const { string} = require('joi')

describe('descsToFields', () => {

  it ('converts joi descriptions to field object', () => {
    console.log(descsToFields({ foo: string() }), () => {})
  })
})
