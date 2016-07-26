const { object, string, number, array, date } = require('joi')

const ArticleAttrs = {
  id: number(),
  title: string().required().min(10),
  created_at: date(),
  blocks: array().items(
    object({
      type: string().valid('image'),
      src: string()
    }).meta({ name: 'ImageBlock' }),
    object({
      type: string().valid('text'),
      body: string()
    }).meta({ name: 'TextBlock' })
  ).default([])
}

module.exports.Query = object(ArticleAttrs).meta({
  name: 'ArticleQuery',
  args: { id: number().required() }
})

module.exports.Mutation = object(ArticleAttrs).meta({
  name: 'ArticleMutation',
  args: ArticleAttrs
})
