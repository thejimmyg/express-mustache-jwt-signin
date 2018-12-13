# Express Mustache JWT Sign In

**CAUTION: Under active development, not suitable for production use for people
outside the development team yet.**

**CAUTION: Plain text only passwords for now.**

## Example

```
npm install
SCRIPT_NAME=/ HTTPS_ONLY=false PORT=9005 SECRET='reallysecret' DEBUG=express-mustache-jwt-signin npm start
```

Visit http://localhost:9005 and sign in with username `hello` and password `world`.

User information in this example is loaded from `yaml/users.yml` via the
`express-mustache-jwt-signin/lib/loadUsers` module.

Notice that `Admin` appears in the top right if the `admin` claim is set to
`true` in the `yaml/users.yml` file when you sign in.

You should be able to make requests to routes restricted with `signedIn`
middleware as long as you have the cookie, or use the JWT in an `Authorization
header like this:

```
Authorization: Bearer <JWT goes here>
```

## Configuration

This module exports two functions, `setupLogin` and `setupMiddleware`. You can
import them like this:

```
const { setupLogin, setupMiddleware } = require('express-mustache-jwt-signin')
```

`setupMiddleware` is used when you want a different Express app to be able to
use the credentials produced by this package. `setupLogin` is for setting up
the middleware and a set of routes, templates and handlers that allows a user
to sign in and out with a web interface. `setupLogin` calls `setupMiddelware`
internally as part of its setup.

**`setupMiddleware(secret, [options])`**

Returns:

* `withUser` - Express middleware for adding `req.user` to the request based on the contents of the JWT
* `signedIn` - Express middleware for ensuring `req.user` is present, and
  redirecting to a sign in page if not for the user to sign in
* `hasClaims` - Express middleware for checking the claims associated with a custom function

Note, `withUser` requires the `cookie-parser` middleware set up first:

```
const cookieParser = require('cookie-parser')

const app = express()
app.use(cookieParser())
```

Requires:

* `secret` - A secret string of at least 8 characters for signing and verifying JWTs

Options:

An object with the following optional keys:

* `jwtCookieName` - The name to use for the cookie that will contain the JWT, e.g. `jwt`
* `signInURL` - The URL path you want the sign in page to appear at, e.g. `'/user/signin'`
* `extractTokenFromRequest` - A function that is passed the request `req` and
  the cookie name `jwtCookieName` and is expected to reurn the JWT as a string.
  The default implementation will obtain a JWT from a cookie first, or the
  `Authorization` header otherwise. If using the `Authorization` header, it
  will accept the JWT itself as the value, or the JWT prefixed with `Bearer `.

**`setupLogin(app, secret, credentials, [options])`** 

Sets up the `withUser` middleware to populate `req.user` as well as routes for
signing a user in and out.

Returns:

The same `withUser` and `signedIn` middleware that `setupMiddleware` returns,
as described above. Although `withUser` isn't really needed because it is
already applied.

`setupLogin()` sets up the `cookie-parser` middleware for you.

Requires:

* `app` - The Express app that should have the middleware and routes applied to it
* `secret` - A secret string of at least 8 characters for signing and verifying JWTs
* `credentials` - Either a credential checking function (see below) or an
  object of credentials of the form `{username: {password, claims}}` where the
  `claims` can be a set of JSON-serialisable key-value pairs to use as JWT
  claims e.g. `{admin: true}`. The `claims` should not include `username` or
  `iat` keys.

If you choose to pass a function as the `credentials` argument, it should take
the `username` and `password` submitted by the form and either return the
claims to be added to the JWT (JSON-serialisable key value pairs excluding
`'username'` and `'iat'` keys) or throw an Error.

Here's a very simple example that only allows the username `hello` and password `world`:

```
async function credentials (username, password) {
  if (username === 'hello' && password === 'world') {
    return { 'admin': true }
  }
  throw new Error('Invalid credentials')
}
```

Internally the function is called with `await` so if you define `credentials`
as an async function you can use `async` and `await` in your definition.

Options:

* `signInURL` - same as in `setupMiddleware()` options described above
* `jwtCookieName` - same as in `setupMiddleware()` options described above
* `extractTokenFromRequest` - same as in `setupMiddleware()` options described above
* `httpsOnly` - defaults to `true` and means the cookie is not sent by the browser over unsecure HTTP. For local testing it is useful to set this to `false`.
* `dashboardURL` - e.g. `'/user/dashboard'`
* `signOutURL` - e.g. `'/user/signout'`
* `signedOutTemplate` - e.g. `'signedOut'`
* `signInTemplate` - e.g. `'signIn'`
* `signedOutTitle` - e.g. `'Signed Out'`
* `signInTitle` - e.g. `'Sign In'`


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

At the moment only JWTs with HS256 will be allowed. You can verify this with a
token that uses a different algorithm like this one which uses `HS512`:

```
export ALG_JWT="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.eym-MugNjwzmD114trr6Mss5KpenDB42MONCDqmaBJyDBisQHCehqoMyPqC80uFtIkwo3uP8N_5Vn9lbYPLB6g"
curl --cookie "jwt=$ALG_JWT;" http://localhost:9005/user/dashboard
```

You'll see:

```
Found. Redirecting to /user/signin
```


## Changelog

### 0.2.3 2018-12-13

* Created `httpsOnly` option for secure cookies. It defaults to `true` and is used as the `secure` parameter to `res.cookie`. The value no longer depends on the value of `NODE_ENV`.
* Support `SCRIPT_NAME` environment variable which defaults to `/` but is passed into the templates as `scriptName` in case paths need to be relative to this URL.
* Created a system for loading user data and claims from `users.yml` data and use it in the example. Have the data automatically reload when the file is changed (although this doesn't take effect until the user signs in and out again).

### 0.2.2

* Modified naming convention for templates and variables
* Documented the options
* Updated the templates to use FlexBox

### 0.2.1

* `credentials` can now be a function which checks a username and password and returns claims, or a data structure like this: `{'hello': {password: 'world', claims: {"admin": true}}}`
* Use `/user/signin`, `/user/dashboard` and `/user/signout` as the URLs so that the whole app can be proxied too to handle auth
* Use the actual URLs in the templates
* Added a `setupMiddleware` function so that you can use the `signedIn` and `withUser` middleware without setting up routes on an express app at the same time
* Explicit use of HS256 algorithm

### 0.2.0

* `signedIn` requires `withUser` first (which it should have if you use `app.use(withUser)`).
* Removed passport, signed cookies
* Return middeleware configured for custom URLs

### 0.1.0

* Initial release
