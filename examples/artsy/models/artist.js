const { string, boolean, object } = require('joi')
const Article = require('./article')

exports.Attrs = {
  name: string(),
  initials: string(),
  gender: string(),
  is_public: boolean(),
  blurb: string(),
  biography: object(Article.Attrs).meta({
    name: 'Article',
    description: 'The artist biography article'
  })
}
