const { string, object, boolean, date } = require('joi')
const Artist = require('./artist')

module.exports.Attrs = {
  title: string(),
  category: string(),
  medium: string(),
  date: date(),
  artist: object(Artist.Attrs).meta({
    name: 'Artist',
    args: {
      shallow: boolean().description('Use whatever is in the original...')
    }
  })
}
