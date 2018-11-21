# Express Mustache JWT Sign In

## Example

```
npm install
PORT=9005 SECRET='reallysecret' DEBUG=true node bin/server.js
```

Visit http://localhost:9005 and sign in with username `hello` and password `world`.

You should be able to make requests to routes restricted with `signedIn`
middleware as long as you have the cookie, or use the JWT in an `Authorization
header like this:

```
Authorization: Bearer <JWT goes here>
```

## Development

```
npm run fix
```

## Docker

```
npm run docker:build
docker login
npm run docker:push
npm run docker:run
```
