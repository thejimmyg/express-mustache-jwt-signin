# Express Mustache JWT Signin

Middleware components and express handlers for handling user authentication and authorization in express.

**CAUTION: Plain text only passwords are still possible.**

**CAUTION: If you use the `express-mustache-jwt-signin:hash` logger (enabled by default), submitted passwords will be logged.**

**NOTE: Make sure you set `COOKIE_SECURE` to `false` if you want your cookies to work over HTTP for testing. Otherwise it will look like the cookie is being set, but the browser will ignore it so you won't be signed in. For production use you should only set secure cookies to be served over HTTPS with `COOKIE_SECURE=true` which is the default.**

**NOTE: Usernames are case insensitive (they are treated as lowercase internally) whereas passwords are case-sensitive.**

## Config

This components in this package use the `app.locals.auth` and `app.locals.signIn` namespaces. They also sets `res.locals.user` on each request.


## How it works

When the user signs in, the username and any claims are encoded into a JSON Web
Token (JWT) and saved in the cookie. The `withUser()` middleware will then parse the
cookie on any subsequent requests, deocde the JWT and set the value as `res.locals.user`. If this object is present, the user is considered signed in.

For example if your username is `hello` and your claims are `{"admin": true}` then the `res.locals.user` object for the response will be set to `{username: "hello", admin: true}`. (This is the example you'll see later in the `users.yml` file).

You can then test if the user is signed-in in a mustache template, as well as
access the username and any claims. Here's an example of all these things in
action in the `./views/partials/userStatus.mustache` template:

```
          {{#user}}
            <strong>{{username}}</strong>{{#admin}} (Admin){{/admin}} <a href="{{#signIn}}{{signOutUrl}}{{/signIn}}">Sign out</a>
          {{/user}}
          {{^user}}
            <a href="{{#auth}}{{signInUrl}}{{/auth}}">Sign in</a>
          {{/user}}
```


## Example

For a full example, see the `./example` directory and `README.md`.

The components also require the following middleware to be installed:

```
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
```

Important things to point out from the example:

* The call to `prepareAuthAndSignIn()` prepares the `app.locals.auth` and `app.locals.signIn` namespacecs.
* The `withUser()` middleware parses the JSON Web Token from the cookie or `Authorization` header and sets `res.locals.user` with the user data.
* The `userManagerFromYml('users.yml')` code prepares a user manager that has a `validPassword()` method that is used to check the user password and return the user information if the password is valid.
* The `setupSignIn()` call installs the handlers that handle sign in and sign out views and logic.
* Other calls prepare and set up template overlays and public file serving.


## Environment Variables

All the environment variables from bootstrap-flexbox-overlay, express-render-error, express-mustache-overlays and express-public-files-overlays are available in the example, but the following are also available from `signInOptionsFromEnv()`:

Used in `setupAuth()`:

* `SECRET` - The secret using for signing the JWT
* `SIGN_IN_URL` - The URL path that the sign in page appears at
* `COOKIE_SECURE` - Defaults to `true` which means that your cookies won't be set over HTTP by default. Set this to `false` when debugging locally to make sure that your cookies are set for testing.
* `COOKIE_NAME` - The name of the auth cookie, default `'jwt'`

**NOTE: Make sure you set `COOKIE_SECURE` to `false` if you want your cookies to work over HTTP for testing.**

`setupSignIn()` uses the options from `setupAuth()` as well as these additional options:

* `DASHBOARD_URL` - URL that the sign in should redirect to when successful. Can be a full URL or a path. e.g `/dashboard'
* `SIGN_OUT_URL` - The URL the user should visit to sign out
* `USERS_YML` - The path of the users YAML file. Defaults to `'users.yml'`.


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

Visit http://localhost:8000 and sign in with username `hello` and password `world`.

You should be able to make requests to routes restricted with `signedIn`
middleware as long as you have the cookie, or use the JWT in an `Authorization
header like this:

```
Authorization: <JWT goes here>
```

Or like this:

```
Authorization: Bearer <JWT goes here>
```

You can access user data by keeping the a reference to the variable returned by `userManagerFromYml('users.yml')`. Its data will reload if you change the file:

```
const { userManagerFromYml } = require('express-mustache-jwt-signin')
const userManager = userManagerFromYml('users.yml')
userManager.getUser('hello')
.then(console.log)
.catch(console.error)
// Because the userManager is running a watch for changes, need to exit explicitly.
.then(() => process.exit(0))
```

**Note: Usernames are treated as lower-case everywhere.**


## Testing using `setUser()`

The `setUser()` middleware allows you to set a user explicitly without using the `setupSignIn()` infrastrucutre. This is handy to add for debugging, or quickly becoming a user for testing some permissions.

```
const { setUser } = require('express-mustache-jwt-signin')
app.use(setUser({username: 'user', admin: true}))
```

The data structure is simply the claims object (if there are any claims), together with an extra key named `username` for the username.

Make sure you set it after `setupAuth()` if you want the user to be overriden, otherwise the middleware from `setupAuth()` will overwrite `app.locals.user` afterwards.


## Development

```
npm run fix
```


### Test


You can test hashing with:

```
npm test
```

or:

```
node bin/test-hash.js
```

You'll see some test output and then the test should exit without an error.

Start the example and then you can test with `curl` like this:

Login:

```
# Success
curl -X POST -v --data "username=hello&password=world" http://localhost:8000/signin
# Failure
curl -X POST -v --data "username=hello&password=INVALID" http://localhost:8000/signin
```

Accessing via cookie or Authorization header:

```
# Using SECRET='reallysecret' as above
export VALID_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.Uj5-C3seMxxrg_H7NaDYoh4LgKE_Br4jIAPzSt8Jyic"
export INVALID_JWT="${VALID_JWT}_invalid"
# Valid
curl -H "Authorization: Bearer $VALID_JWT" http://localhost:8000/dashboard
curl --cookie "jwt=$VALID_JWT;" http://localhost:8000/dashboard
# Invalid
curl -H "Authorization: Bearer $INVALID_JWT" http://localhost:8000/dashboard
curl --cookie "jwt=$INVALID_JWT;" http://localhost:8000/dashboard
```

At the moment only JWTs with HS256 will be allowed. You can verify this with a
token that uses a different algorithm like this one which uses `HS512`:

```
export ALG_JWT="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7InVzZXJuYW1lIjoiaGVsbG8iLCJyb2xlIjoiYWRtaW4ifSwiaWF0IjoxNTQzNTg4MjE3fQ.eym-MugNjwzmD114trr6Mss5KpenDB42MONCDqmaBJyDBisQHCehqoMyPqC80uFtIkwo3uP8N_5Vn9lbYPLB6g"
curl --cookie "jwt=$ALG_JWT;" http://localhost:8000/dashboard
```

You'll see:

```
Found. Redirecting to /signin
```

## Response Variables

You can set `metaDescription` in the data of each call to `res.render()` to set the description meta tag.


## Scripts

You can generate a new password hash from the command line like this:

```
npm run jwt-signin-hash
```

Or, if the pacakge is installed globally, directly like this:

```
jwt-signin-hash
```


## Dev

```
npm run fix
```


## Changelog

### 0.5.1 2019-02-07

* Publish the codebase, not the example.

### 0.5.0 2019-02-07

* Big refactor and simplification
* Split out the auth side of things from the sign in and sign out side of things
* Can use auth middleware directly, without complex setup
* Only one way of providing credentials now, via a user manager `validPassword()` method.
* Set up redirect as a template so it can be overridden
* Changed `HTTPS_ONLY` to `COOKIE_SECURE` to be clearer
* Removed `DISABLE_AUTH` and `DISABLED_AUTH_USER` and instead provided `setUser()` middleware which you can use yourself
* Removed `FORBIDDEN_TITLE` and `FORBIDDEN_TEMPLATE` since you can always overlay a new 403 for customisation
* Also removed `SIGNED_OUT_TEMPLATE`, `SIGNED_OUT_TITLE`, `SIGN_IN_TITLE` and `SIGN_IN_TEMPLATE` for the same reason
* Removed the admin page (instead the `views/userStatus.mustache` template demonstrates the use of a claim (`admin`)
* Removed the generate a hash page - instead use the command line tool to generate hashed passwords
* Upgraded express-mustache-overlays, express-public-files-overlays, express-render-error etc
* Moved Changelog to separate `CHANGELOG.md`

Please look in `CHANGELOG.md` in future as this entry will move too.
