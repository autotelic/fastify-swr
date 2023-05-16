const fastify = require('fastify')
const { test } = require('tap')
const { stub } = require('sinon')

const fastifySwr = require('..')

async function createApp (swrOpts) {
  const app = fastify()

  await app.register(fastifySwr, swrOpts)

  return app
}

const KEY = '/test'
const VALUE = { foo: 'bar' }

test('should throw an error when no handler is provided', async ({ rejects }) => {
  rejects(createApp, Error('(fastify-swr) handler is a required option'))
})

test('Should decorate Fastify instance with the provided `name` option', async ({ equal }) => {
  const app = await createApp({ handler: () => null, name: 'customDecoratorName', logger: null })
  equal(app.hasDecorator('customDecoratorName'), true)
})

test('Should trigger revalidation and return cached value when stale', async ({ equal, same }) => {
  const handlerStub = stub()

  handlerStub.onFirstCall().returns(VALUE)

  const newValue = { result: 99 }
  handlerStub.onSecondCall().returns(newValue)

  function testHandler () {
    return handlerStub()
  }

  const app = await createApp({ handler: testHandler, interval: 0 })

  const initialCall = await app.testHandler(KEY)

  const staleCall = await app.testHandler(KEY)

  const revalidatedCall = await app.testHandler(KEY)

  equal(handlerStub.callCount, 2, 'handler should be called twice')
  same(initialCall, VALUE)
  same(staleCall, VALUE, 'handler should return cached value when stale cache is first detected')
  same(revalidatedCall, newValue)
})

test('Should return cached value when cache is not stale', async ({ equal, same }) => {
  const handlerStub = stub()

  handlerStub.onFirstCall().returns(VALUE)

  function testHandler () {
    return handlerStub()
  }

  const app = await createApp({ handler: testHandler })

  const initialCall = await app.testHandler(KEY)

  const secondCall = await app.testHandler(KEY)

  equal(handlerStub.callCount, 1, 'handler should be called once')
  same(initialCall, VALUE)
  same(secondCall, VALUE)
})

test('Should return cached data when revalidation is already in progress', async ({ equal, same }) => {
  const handlerStub = stub()
  handlerStub.onFirstCall().returns(VALUE)

  const newValue = { result: 99 }
  handlerStub.onSecondCall().returns(newValue)

  async function testHandler () {
    return handlerStub()
  }

  const app = await createApp({ handler: testHandler, interval: 0 })

  // Prime the cache
  const initialCall = await app.testHandler(KEY)

  // Give first stale call a small head start
  const pStaleCall = app.testHandler(KEY)
  // This call will occur with a revalidation still pending
  const pDedupedCall = app.testHandler(KEY)

  const [
    staleCall,
    dedupedCall
  ] = await Promise.all([
    pStaleCall,
    pDedupedCall
  ])

  const revalidatedCall = await app.testHandler(KEY)

  equal(handlerStub.callCount, 2, 'handler should be called twice')
  same(initialCall, VALUE)
  same(staleCall, VALUE, 'should return cached value on first stale call')
  same(dedupedCall, VALUE, 'should return cached value when revalidation is currently in progress')
  same(revalidatedCall, newValue)
})

test('Should call the appropriate methods when using custom cache client and client mapping', async ({ equal, same, teardown }) => {
  const stubDateMs = 1684263312384

  stub(Date, 'now')
  Date.now.returns(stubDateMs)

  teardown(async () => {
    Date.now.restore()
  })

  const createCacheClient = ({ get, set, delete: del }) => ({
    fetch: get,
    update: set,
    del
  })

  const getStub = stub()
  const setStub = stub()
  const deleteStub = stub()

  const cacheClient = createCacheClient({
    get: getStub,
    set: setStub,
    delete: deleteStub
  })

  const intervalMs = 1000

  getStub.onFirstCall().resolves(JSON.stringify({ data: VALUE, staleAt: stubDateMs - intervalMs }))
  getStub.onSecondCall().resolves()
  setStub.resolves()
  deleteStub.resolves()

  const handlerStub = stub()

  handlerStub.onFirstCall().returns(VALUE)

  function testHandler () {
    return handlerStub()
  }

  const app = await createApp({
    handler: testHandler,
    interval: intervalMs / 1000, // convert to seconds
    cache: cacheClient,
    cacheClientMapping: {
      get: 'fetch',
      set: 'update',
      delete: 'del'
    }
  })

  await app.testHandler(KEY)

  await app.testHandler(KEY)

  equal(handlerStub.callCount, 1, 'handler should be called once')
  same(getStub.callCount, 2, 'should call the renamed get method twice')
  same(getStub.args, [[KEY], [KEY]], 'should call the renamed get method with the expected args')
  same(deleteStub.callCount, 1, 'should call the renamed delete method once')
  same(deleteStub.args, [[KEY]], 'should call the renamed delete method with the expected args')
  same(setStub.callCount, 1, 'should call the renamed set method once')
  same(
    setStub.args,
    [[KEY, JSON.stringify({ data: VALUE, staleAt: stubDateMs + intervalMs })]],
    'should call the renamed set method with the expected args')
})
