# Express Mustache JWT Sign In

**CAUTION: Under active development, not suitable for production use for people
outside the development team yet.**

**CAUTION: Plain text only passwords are still possible.**

**CAUTION: If you use the `express-mustache-jwt-signin:hash` logger (enabled by default), submitted passwords will be logged.**

## Password format in `yaml/users.yml`

The `password` field can contain plain text or hashed passwords. If the password is more than 64 characters, it is treated as a hashed password.

You need the `admin: true` claim in order to access `/hash` for generating a password hashes to go in `yaml/users.yml` and `/admin` to test whether you have the admin claim or not.

The default password for the `hello` user in `yaml/users.yaml` is `world`.

Here's an example for the `world` password, using a hash:

```
hello:
  password: eyJoYXNoIjoiQnNKVlZ3c1hNaC9zcDJzWk1WWlBiL1d5K3EyeHJUZVY5VS82RmdSZDUrRWZCNTY3aU9hWmY4T05xQWcyR2dBQ0szb0lDcC9WbFNLQUdWSVRLbnVjaGlVeSIsInNhbHQiOiIyeWEyTnBVYXk4L0JMZ2Nkb3VZZXlsS3BvT04rSVplZ3A2aHlWRUxQWXM4Mk5UTUdHVHFuQlZnOHM3QWoxS0tLZ2lqb2Z3NlB0WFA4eTJXdnhIWkxTWktGIiwia2V5TGVuZ3RoIjo2NiwiaGFzaE1ldGhvZCI6InBia2RmMiIsIml0ZXJhdGlvbnMiOjcxNTA5fQ==
  email: hello@example.com
  claims:
    admin: true
```

## Example

```
npm install
DEBUG=express-mustache-jwt-signin:hash node lib/hash.js
USERS_YML=yaml/users.yml MUSTACHE_DIRS="" SCRIPT_NAME="" HTTPS_ONLY=false PORT=8000 SECRET='reallysecret' DEBUG=express-mustache-jwt-signin,express-mustache-jwt-signin:credentials,express-mustache-jwt-signin:hash,express-mustache-overlays npm start
```

You can also set these defaults:

* `DASHBOARD_URL` - where the sign in should redirect to
* `SIGN_IN_URL`
* `COOKIE_NAME`
* `FORBIDDEN_TEMPLATE`
* `FORBIDDEN_TITLE`
* `HTTPS_ONLY` - Defaults to `true` which means that your cookies won't be set over HTTP by default. Set this to `false` when debugging locally to make sure that your cookies are set for testing.

**NOTE: Make sure you set `HTTPS_ONLY` to `false` if you want your cookies to work over HTTP for testing.**

Visit http://localhost:8000 and sign in with username `hello` and password `world`.

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

You can access user data by keeping the a reference to the varibale returned by `createCredentialsFromWatchedUsersYaml()`. Its `.users` attribute will be updated as the file changes:

```
const userData = await createCredentialsFromWatchedUsersYaml(process.env.USERS_YML)
console.log(userData.users)
```

Then use `userData.credentials` as your credentials function. (There is also a `userData.passwords` which you should not use.)

**Note: Usernames are treated as lower-case everywhere. So you should use a lower-case email when looking up data in `userData.users`**

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
* `signInURL` - The URL path you want the sign in page to appear at, e.g. `'/signin'`
* `extractTokenFromRequest` - A function that is passed the request `req` and
  the cookie name `jwtCookieName` and is expected to reurn the JWT as a string.
  The default implementation will obtain a JWT from a cookie first, or the
  `Authorization` header otherwise. If using the `Authorization` header, it
  will accept the JWT itself as the value, or the JWT prefixed with `Bearer `.
* `forbiddenTemplate` - the name of the template to render by `hasClaims` if the check fails
* `forbiddenTitle` - the title to give the page rendered by `hasClaims` if the check fails

**`setupLogin(app, secret, credentials, [options])`**

Sets up the `withUser` middleware to populate `req.user` as well as routes for
signing a user in and out.

Returns:

The same `withUser`, `signedIn` and `hasClaims` middleware that `setupMiddleware` returns,
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
* `forbiddenTemplate` - same as in `setupMiddleware()` options described above
* `forbiddenTitle` - same as in `setupMiddleware()` options described above
* `httpsOnly` - defaults to `true` and means the cookie is not sent by the browser over unsecure HTTP. For local testing it is useful to set this to `false`.
* `dashboardURL` - e.g. `'/dashboard'`
* `signOutURL` - e.g. `'/signout'`
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

**NOTE: When running from Docker, we don't use the development yaml/users.yml
you are expected to mount your own `yaml` volumne containing your `users.yml`
into `/app/yaml`.**

### Test

Login:

```
# Success
curl -X POST -v --data "username=hello&password=world" http://localhost:8000/user/signin
# Failure
curl -X POST -v --data "username=hello&password=INVALID" http://localhost:8000/user/signin
```

Accessing via cookie or Authorization header:

```
# Using SECRET='reallysecret' as above
export VALID_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.Uj5-C3seMxxrg_H7NaDYoh4LgKE_Br4jIAPzSt8Jyic"
export INVALID_JWT="${VALID_JWT}_invalid"
# Valid
curl -H "Authorization: Bearer $VALID_JWT" http://localhost:8000/user/dashboard
curl --cookie "jwt=$VALID_JWT;" http://localhost:8000/user/dashboard
# Invalid
curl -H "Authorization: Bearer $INVALID_JWT" http://localhost:8000/user/dashboard
curl --cookie "jwt=$INVALID_JWT;" http://localhost:8000/user/dashboard
```

At the moment only JWTs with HS256 will be allowed. You can verify this with a
token that uses a different algorithm like this one which uses `HS512`:

```
export ALG_JWT="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.eym-MugNjwzmD114trr6Mss5KpenDB42MONCDqmaBJyDBisQHCehqoMyPqC80uFtIkwo3uP8N_5Vn9lbYPLB6g"
curl --cookie "jwt=$ALG_JWT;" http://localhost:8000/user/dashboard
```

You'll see:

```
Found. Redirecting to /user/signin
```


## Changelog

### 0.2.12 2018-12-20

* Include `Sign Out` link and `Admin` claim in `userStatus.partial`

### 0.2.11 2018-12-20

* Set `res.locals.user` in the `withUser` middleware
* Pass config directly to the middleware
* Fix error message from `rest` not correctly specifying key names

### 0.2.10 2018-12-20

* Upgrade to `express-mustache-overlays` version 0.2.2

### 0.2.9 2018-12-20

* Upgrade to `express-mustache-overlays` version 0.2.1

### 0.2.8 2018-12-20

* Added try, catch blocks around the async handlers
* Logging the cookie options
* Responding to the `HTTPS_ONLY` environment variable in the `lib/index.js`, rather than `bin/server.js` so that it takes effect in extrenal projects using `setupLogin()` too.

### 0.2.7 2018-12-19

* Adding a 500 handler
* Moving nav links to the left hand side and inclusing `Hash`
* Upaded docker config for `npm run docker:run`
* Generated hashes now appear as a success message on the hash page, not a plain text response

### 0.2.6 2018-12-19

* Added a password hashing page at `/hash` for users with the `admin: true` claim
* Added `express-mustache-jwt-signin:hash` logger and for the `lib/loadUsers.js` module to treat passwords >= 64 characters in length as base64-encoded password hashes to be decoded and verified with `credential`

### 0.2.5 2018-12-17

* Make `DASHBOARD_URL` configurable.
* Added missing `js-yaml` dependency.
* Changed `top.mustache` flexbox height

### 0.2.4 2018-12-15

* Made mustacheDirs an array for correct reloading, and allow preferred overlays to be specified as `MUSTACHE_DIRS=viewsDir1:viewsDir2:viewsDir3` etc. The defaults in `views` will still be used last if a particular template or partial can't be found in the specified directories.
* Added a 403 page instead of a redirect to sign in when a page is forbidden
* Big refactor of the code to make Let's Encrypt fetching disabled by default, and enabled with the `--lets-encrypt` flag
* Swapped `commander` npm package for `dashdash`
* Home page removed from example, redirects to `dashboardURL` directly, and `dashboardURL` part of the `templateDefaults`
* Changed the `users.yml` file reloading to be throttled, and also reload on delete and overwrite, having empty user data if there is no file.
* Ability to specify the `users.yml` file path with `USERS_YML`

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
