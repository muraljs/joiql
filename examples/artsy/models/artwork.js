const { string, object, boolean, date } = require('joi')
const Artist = require('./artist')
const request = require('superagent')
const artsyXapp = require('artsy-xapp')

const { ARTSY_URL } = process.env

exports.Attrs = {
  title: string(),
  category: string(),
  medium: string(),
  date: date(),
  artist: object(Artist.Attrs).meta({
    name: 'Artist',
    args: {
      shallow: boolean().default(false)
        .description('Use whatever is in the original...')
    }
  })
}

exports.resolveArtist = ({ req, res }) => {
  if (req.args.shallow) return Promise.resolve()
  return request
    .get(`${ARTSY_URL}/api/v1/artist/${res.artwork.artist.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => { res.artwork.artist = body })
}
