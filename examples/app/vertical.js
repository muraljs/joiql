const { object, string, number, array, date, boolean } = require('joi')

const VerticalAttrs = {
  id: number(),
  title: string().default(''),
  meta_title: string().default(''),
  description: string().default(''),
  slug: string().default(''),
  partner_logo_url: string().default(''),
  partner_website_url: string().default(''),
  thumbnail_url: string().default(''),
  featured_links_header: string().default(''),
  featured_links: array().items([
    object({
      thumbnail_url: string().default(''),
      title: string().default(''),
      url: string().default('')
    })
  ]).allow(null),
  featured: boolean().default(false),
  start_at: date(),
  end_at: date(),
  slogan: string()
}

exports.Query = object(VerticalAttrs).meta({
  name: 'VerticalQuery',
  args: { id: number().required() }
})

exports.Mutation = object(VerticalAttrs).meta({
  name: 'VerticalMutation',
  args: VerticalAttrs
})
