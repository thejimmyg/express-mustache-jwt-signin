# Changelog


## 0.4.0 2019-01-19

* Upgraded to express-mustache-overlays 0.4.2
* Renamed all `*URL` variables that aren't environment variables to `*Url` e.g. `signInURL` -> `signInUrl` **Caution: This means your templates that use these variables will need to be updated.**
* Added `signInOptionsFromEnv()` function

## 0.3.3 2019-01-02

* Handle SIGTERM
* Included an example of using the middleware in another app.

## 0.3.2 2018-12-24

* Support `DASHBOARD_URL`
* Add `makeStaticWithUser()` function

## 0.3.1 2018-12-21

* Default port for `Dockerfile` is now 80
* Fixed a bug with `MUSTACHE_DIRS` and `PUBLIC_FILES_DIRS` not working correctly from the example

## 0.3.0 2018-12-21

* Refactor for `express-mustache-overlays` 0.3.0, and updated example
* Change the API to require an `overlays` argument in `setupLogin` and have it as an optional requirement in `setupMiddleware`
* `setupMiddleware` is now async and so requires awaiting
* No environment variables needed in `lib`
* More variables configurable from the environment

## 0.2.12 2018-12-20

* Include `Sign Out` link and `Admin` claim in `userStatus.partial`

## 0.2.11 2018-12-20

* Set `res.locals.user` in the `withUser` middleware
* Pass config directly to the middleware
* Fix error message from `rest` not correctly specifying key names

## 0.2.10 2018-12-20

* Upgrade to `express-mustache-overlays` version 0.2.2

## 0.2.9 2018-12-20

* Upgrade to `express-mustache-overlays` version 0.2.1

## 0.2.8 2018-12-20

* Added try, catch blocks around the async handlers
* Logging the cookie options
* Responding to the `HTTPS_ONLY` environment variable in the `lib/index.js`, rather than `bin/server.js` so that it takes effect in extrenal projects using `setupLogin()` too.

## 0.2.7 2018-12-19

* Adding a 500 handler
* Moving nav links to the left hand side and inclusing `Hash`
* Upaded docker config for `npm run docker:run`
* Generated hashes now appear as a success message on the hash page, not a plain text response

## 0.2.6 2018-12-19

* Added a password hashing page at `/hash` for users with the `admin: true` claim
* Added `express-mustache-jwt-signin:hash` logger and for the `lib/loadUsers.js` module to treat passwords >= 64 characters in length as base64-encoded password hashes to be decoded and verified with `credential`

## 0.2.5 2018-12-17

* Make `DASHBOARD_URL` configurable.
* Added missing `js-yaml` dependency.
* Changed `top.mustache` flexbox height

## 0.2.4 2018-12-15

* Made mustacheDirs an array for correct reloading, and allow preferred overlays to be specified as `MUSTACHE_DIRS=viewsDir1:viewsDir2:viewsDir3` etc. The defaults in `views` will still be used last if a particular template or partial can't be found in the specified directories.
* Added a 403 page instead of a redirect to sign in when a page is forbidden
* Big refactor of the code to make Let's Encrypt fetching disabled by default, and enabled with the `--lets-encrypt` flag
* Swapped `commander` npm package for `dashdash`
* Home page removed from example, redirects to `dashboardURL` directly, and `dashboardURL` part of the `templateDefaults`
* Changed the `users.yml` file reloading to be throttled, and also reload on delete and overwrite, having empty user data if there is no file.
* Ability to specify the `users.yml` file path with `USERS_YML`

## 0.2.3 2018-12-13

* Created `httpsOnly` option for secure cookies. It defaults to `true` and is used as the `secure` parameter to `res.cookie`. The value no longer depends on the value of `NODE_ENV`.
* Support `SCRIPT_NAME` environment variable which defaults to `/` but is passed into the templates as `scriptName` in case paths need to be relative to this URL.
* Created a system for loading user data and claims from `users.yml` data and use it in the example. Have the data automatically reload when the file is changed (although this doesn't take effect until the user signs in and out again).

## 0.2.2

* Modified naming convention for templates and variables
* Documented the options
* Updated the templates to use FlexBox

## 0.2.1

* `credentials` can now be a function which checks a username and password and returns claims, or a data structure like this: `{'hello': {password: 'world', claims: {"admin": true}}}`
* Use `/user/signin`, `/user/dashboard` and `/user/signout` as the URLs so that the whole app can be proxied too to handle auth
* Use the actual URLs in the templates
* Added a `setupMiddleware` function so that you can use the `signedIn` and `withUser` middleware without setting up routes on an express app at the same time
* Explicit use of HS256 algorithm

## 0.2.0

* `signedIn` requires `withUser` first (which it should have if you use `app.use(withUser)`).
* Removed passport, signed cookies
* Return middeleware configured for custom URLs

## 0.1.0

* Initial release
