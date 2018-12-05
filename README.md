# Express Mustache JWT Sign In

**CAUTION: Under active development, not suitable for production use for people
outside the development team yet.**

## Example

```
npm install
PORT=9005 SECRET='reallysecret' DEBUG=express-mustache-jwt-signin npm start
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
docker login <REGISTRY_URL>
npm run docker:push
npm run docker:run
```

### Test

Login:

```
# Success
curl -X POST -v --data "username=hello&password=world" http://localhost:9005/user/signin
# Failure
curl -X POST -v --data "username=hello&password=INVALID" http://localhost:9005/user/signin
```

Accessing via cookie or Authorization header:

```
# Using SECRET='reallysecret' as above
export VALID_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.Uj5-C3seMxxrg_H7NaDYoh4LgKE_Br4jIAPzSt8Jyic"
export INVALID_JWT="${VALID_JWT}_invalid"
# Valid
curl -H "Authorization: Bearer $VALID_JWT" http://localhost:9005/user/dashboard
curl --cookie "jwt=$VALID_JWT;" http://localhost:9005/user/dashboard
# Invalid
curl -H "Authorization: Bearer $INVALID_JWT" http://localhost:9005/user/dashboard
curl --cookie "jwt=$INVALID_JWT;" http://localhost:9005/user/dashboard
```

At the moment only JWTs with HS256 will be allowed (since this is the default
of that `algorithm` setting of the `jsonwebtoken` package this package depends
on). You can verify this with a valid token, but with a different algorithm
like this:

```
export VALID_JWT="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.eym-MugNjwzmD114trr6Mss5KpenDB42MONCDqmaBJyDBisQHCehqoMyPqC80uFtIkwo3uP8N_5Vn9lbYPLB6g"
curl --cookie "jwt=$INVALID_JWT;" http://localhost:9005/user/dashboard
```

You'll see:

```
Found. Redirecting to /user/signin
```


## Changelog

### 0.2.1

* `credentials` can now be a function which checks a username and password and returns claims, or a data structure like this: `{'hello': {password: 'world', claims: {"admin": true}}}`
* Use `/user/signin`, `/user/dashboard` and `/user/signout` as the URLs so that the whole app can be proxied too to handle auth
* Use the actual URLs in the templates

### 0.2.0

* `signedIn` requires `withUser` first (which it should have if you use `app.use(withUser)`).
* Removed passport, signed cookies
* Return middeleware configured for custom URLs

### 0.1.0

* Initial release
