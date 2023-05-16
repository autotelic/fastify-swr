# Fastify SWR

stale-while-revalidate caching and request de-duplication for **fastify**

## Getting Started

### Install

```sh
npm i @autotelic/fastify-swr
```

### Usage

```js
const fastifySwr = require('@autotelic/fastify-swr')

async function myClient (path, opts = {}) {
  const res = await fetch(new URL(`https://example.com/${path}`), opts)
  return res.json()
}

async function rootPlugin (fastify, opts) {
  await fastify.register(fastifySwr, { handler: myClient, interval: 10 })

  fastify.get('/', async function routeHandler (request, reply) {
    // By default, the handler's name will be used to name the decorator (see API for mor details)
    const content = await fastify.myClient('/endpoint', {
      headers: {
        accept: 'application/json'
      }
    })
    return content
  })
}
```

#### Example App

To run the example app clone this repo locally, `npm i`, and then run the following

```sh
npm run dev
```

Once running, navigate to `localhost:3000` in the browser

## API

### `fastifySwr`: `FastifyPluginAsync<PluginOpts>`

#### `PluginOpts`

`fastifySwr` accepts a `PluginOpts` object with the following properties:

- **`handler`: `(key: string, ...args: any[]) => any`** - *Required*. The function to be wrapped by the plugin. The return value of the `handler` will be cached using a stale-while-revalidate caching strategy. The `handler` will be called only when the cache is empty or stale. The wrapped handler is accessible as a decorator on the Fastify instance. By default, the handler's name will be used to name the decorator (ie. `fastify.myHandler`). A custom decorator name can configured using the `name` option.

- **`interval`: `number`** - The interval in seconds used to determine when a cache will be deemed stale. *Defaults to `60` seconds*.

- **`name`: `string`** - A custom name for the decorator added by this plugin. By default, the name property of the `handler` will be used.

- **`cache`: `Pick<Map, 'get' | 'set' | 'delete'>`** - The cache instance for the plugin to use. Must contain `get`, `set`, and `delete` methods matching the signature of a `Map`. Method names can be changed using the `cacheClientMapping` option below. *Defaults to `new Map()`*.

- **`cacheClientMapping`: `{ get: string, set: string, delete: string }`** - An object used to map custom client method names to the default `cache` method names. For example, if using a Redis client you would pass in `{ delete: 'del' }`.

- **`logger`: `{ debug: (log: string) => void }`** - A logger to be used for the plugin's debug logs. *Defaults to `fastify.log` (Note: the log-level must be set to 'debug' to view the plugin's logs)*.
