const { string, boolean, object } = require('joi')
const Article = require('./article')

module.exports.Attrs = {
  name: string(),
  initials: string(),
  gender: string(),
  is_public: boolean(),
  biography: object(Article.Attrs).meta({
    name: 'Article',
    description: 'The artist biography article'
  })
}
