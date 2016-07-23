const joiql = require('../')
const { object, string, boolean } = require('joi')
const request = require('superagent')
const artsyXapp = require('artsy-xapp')
const { ARTSY_URL } = process.env

// Schemas
const Artist = object({
  id: string(),
  name: string()
})
const Artwork = object({
  id: string(),
  title: string(),
  artist: Artist.meta({
    args: { shallow: boolean() }
  })
})
const api = joiql({
  query: {
    artwork: Artwork.meta({
      args: { id: string().required() }
    }),
    artist: Artist.meta({
      args: { id: string().required() }
    })
  }
})

// JoiQL Middleware
api.on('query.artwork', ({ args }, res) => {
  return request
    .get(`${ARTSY_URL}/api/v1/artwork/${args.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => {
      res.artwork = body
    })
})
api.on('query.artwork.fields.artist.args', ({ shallow }, res) => {
  if (shallow) return
  return request
    .get(`${ARTSY_URL}/api/v1/artist/${res.artwork.artist.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => {
      res.artwork.artist = body
    })
})
api.on('query.artist', ({ args }, res) => {
  return request
    .get(`${ARTSY_URL}/api/v1/artist/${args.id}`)
    .set('X-Xapp-Token', artsyXapp.token)
    .then(({ body }) => {
      res.artist = body
    })
})

// Mount GraphQL into Express
const app = require('express')()
const graphqlHTTP = require('express-graphql')
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))
artsyXapp.init(() => {
  app.listen(3000, () => console.log('listening on 3000'))
})
artsyXapp.on('error', console.log)
