const { map } = require('lodash')
const { ARTSY_URL, POSITRON_URL } = process.env
const request = require('superagent')
const artsyXapp = require('artsy-xapp')

module.exports.fetch = ({ req, res }) => {
  const promises = map(req, ({ args }, resource) => {
    return request
      .get(
        resource === 'article'
        ? `${POSITRON_URL}/api/articles/${args.id}`
        : `${ARTSY_URL}/api/v1/${resource}/${args.id}`
      )
      .set('X-Xapp-Token', artsyXapp.token)
      .then(({ body }) => { res[resource] = body })
  })
  return Promise.all(promises)
}
