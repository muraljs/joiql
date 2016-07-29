const { string, object, number, array } = require('joi')
const Artist = require('./artist')

exports.Attrs = {
  _id: string(),
  name: string(),
  artists: array().items(object(Artist.Attrs)),
  artworks_count: number()
}
