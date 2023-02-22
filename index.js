const fp = require('fastify-plugin')

const PKG_NAME = 'fastify-swr'

class SWR {
  constructor ({ cache, handler, interval, logger }) {
    if (!handler) throw Error(`(${PKG_NAME}) handler is a required option`)
    this._cache = cache ?? new Map()
    this._handler = handler
    this._interval = interval ?? 60
    this._pendingUpdates = {}
    this._logger = logger ?? console
  }

  async getData (key, ...args) {
    const { data: cachedData, staleAt = Infinity } = this._cache.get(key) ?? {}
    if (!cachedData) {
      this._logger.debug(`(${PKG_NAME}) Cached data not found for key: ${key}`)
      const data = await this._deDupedHandler(key, ...args)
      const staleAt = Date.now() + (this._interval * 1000)
      this._cache.set(key, { data, staleAt })
      return data
    }
    if (staleAt <= Date.now()) {
      this._logger.debug(`(${PKG_NAME}) Triggering update for stale key: ${key}`)
      await this._triggerRevalidate(key, ...args)
      this._cache.delete(key)
    }
    this._logger.debug(`(${PKG_NAME}) Returning cached data for key: ${key}`)
    return cachedData
  }

  async _deDupedHandler (key, ...args) {
    try {
      if (this._pendingUpdates[key]) {
        this._logger.debug(`(${PKG_NAME}) Awaiting pending update for key: ${key}`)
        return await this._pendingUpdates[key]
      }
      this._logger.debug(`(${PKG_NAME}) Running handler for key: ${key}`)
      return await (this._pendingUpdates[key] = this._handler(key, ...args))
    } finally {
      this._logger.debug(`(${PKG_NAME}) Update complete for key: ${key}`)
      delete this._pendingUpdates[key]
    }
  }

  async _triggerRevalidate (key, ...args) {
    if (!this._pendingUpdates[key]) {
      this._logger.debug(`(${PKG_NAME}) Queueing update for key: ${key}`)
      this._pendingUpdates[key] = this._handler(key, ...args)
    } else {
      this._logger.debug(`(${PKG_NAME}) Update already pending, skipping queue for key: ${key}`)
    }
  }
}

async function swrPlugin (fastify, { handler, name, ...swrOpts }) {
  const handlerName = name ?? handler?.name ?? 'swr'
  const swrClient = new SWR({ handler, logger: fastify.log, ...swrOpts })
  fastify.decorate(handlerName, (path, ...args) => swrClient.getData(path, ...args))
}

module.exports = fp(swrPlugin, {
  name: PKG_NAME,
  fastify: '4.x'
})
