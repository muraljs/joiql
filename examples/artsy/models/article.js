const { string, date } = require('joi')

module.exports.Attrs = {
  title: string(),
  published_at: date(),
  slug: string()
}
