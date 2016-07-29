const { string, date } = require('joi')

exports.Attrs = {
  title: string(),
  published_at: date(),
  slug: string()
}
