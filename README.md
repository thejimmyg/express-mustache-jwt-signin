# Express Mustache JWT Sign In

## Example

```
npm install
PORT=9005 SECRET='reallysecret' DEBUG=express-mustache-jwt-signin node bin/server.js
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

### Test

```
# Using SECRET='reallysecret' as above
export VALID_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.Uj5-C3seMxxrg_H7NaDYoh4LgKE_Br4jIAPzSt8Jyic"
export INVALID_JWT="${VALID_JWT}_invalid"
# Valid
curl -H "Authorization: Bearer $VALID_JWT" http://localhost:9005/dashboard
curl --cookie "jwt=$VALID_JWT;" http://localhost:9005/dashboard
# Invalid
curl -H "Authorization: Bearer $INVALID_JWT" http://localhost:9005/dashboard
curl --cookie "jwt=$INVALID_JWT;" http://localhost:9005/dashboard
```

## Changelog

### 0.2.0

* `signedIn` requires `withUser` first (which it should have if you use `app.use(withUser)`).
* Removed passport, signed cookies
* Return middeleware configured for custom URLs

### 0.1.0

* Initial release
