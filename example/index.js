const swrPlugin = require('..')
const { fetch } = require('undici')

const boredApi = 'https://www.boredapi.com'

async function boredApiClient (path, opts = {}) {
  const res = await fetch(new URL(`${boredApi}/api${path}`), opts)
  return res.json()
}

async function rootPlugin (fastify, opts) {
  await fastify.register(swrPlugin, { handler: boredApiClient, interval: 10 })

  fastify.get('/', async function routeHandler (request, reply) {
    const activity = await fastify.boredApiClient('/activity', {
      headers: {
        'content-type': 'application/json'
      }
    })
    reply.type('text/html')
    return `<h1>Bored?</h1><h3>Have you tried to ${activity.activity.toLowerCase()}</h3>`
  })
}

module.exports = rootPlugin
