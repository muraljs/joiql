const joiql = require('../../')
const app = require('express')()
const graphqlHTTP = require('express-graphql')
const Article = require('./models/article')
const Artwork = require('./models/artwork')
const Artist = require('./models/artist')
const Show = require('./models/show')
const { object, string } = require('joi')
const artsyXapp = require('artsy-xapp')
const cache = require('./middleware/cache')
const rest = require('./middleware/rest')

const api = joiql({
  query: {
    artwork: object(Artwork.Attrs).meta({ args: { id: string().required() } }),
    article: object(Article.Attrs).meta({ args: { id: string().required() } }),
    artist: object(Artist.Attrs).meta({ args: { id: string().required() } }),
    show: object(Show.Attrs).meta({ args: { id: string().required() } })
  }
})

// JoiQL Middleware
api.on('query', cache.get)
api.on('query', rest.fetch)
api.on('query.artwork.fields.artist', Artwork.resolveArtist)
api.on('query', cache.set)

// Start express server
app.use('/graphql', graphqlHTTP({
  schema: api.schema,
  graphiql: true
}))

artsyXapp.init(() => {
  app.listen(3000, () => console.log('listening on 3000'))
})
artsyXapp.on('error', console.log)
