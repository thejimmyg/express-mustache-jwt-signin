const express = require('express')
const { prepareDebug, prepareOption, optionFromEnv, installSignalHandlers, setupErrorHandlers } = require('express-render-error')
const debug = require('debug')('express-mustache-jwt-signin:server')
const { prepareMustache, setupMustache, mustacheFromEnv } = require('express-mustache-overlays')
const { preparePublicFiles, setupPublicFiles, publicFilesFromEnv } = require('express-public-files-overlays')
const { prepareTheme, bootstrapOptionsFromEnv } = require('bootstrap-flexbox-overlay')
const { signedIn, prepareAuth, withUser, authOptionsFromEnv } = require('express-mustache-jwt-signin')
const { setupSignIn, prepareSignIn, signInOptionsFromEnv } = require('express-mustache-jwt-signin')
const { userManagerFromYml } = require('express-mustache-jwt-signin')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

// Install signal handlers
installSignalHandlers()

// Create the app and set up configuration
const app = express()
prepareDebug(app, debug)
prepareOption(app, optionFromEnv(app))
prepareMustache(app, mustacheFromEnv(app))
preparePublicFiles(app, publicFilesFromEnv(app))
prepareTheme(app, bootstrapOptionsFromEnv(app))

const envSignInOptions = signInOptionsFromEnv(app)
const envAuthOptions = authOptionsFromEnv(app)
if ((typeof envAuthOptions.secret === 'undefined') || (envAuthOptions.cookieSecure !== true)) {
  const msg = 'WARNING: Settings only for development. Need to set secret and cookieSecure for production.'
  debug(msg)
  console.error(msg)
}
const defaultAuthOptions = {
  signInUrl: '/signin',
  // Change this!
  secret: 'reallysecret', // Needs to be long and kept secret for production
  cookieSecure: false // Should be set to true to only allow browsers to accept cookies over HTTPS
}
// We don't want to keep secret in app.locals.auth so it gets returned to be used explicitly in withUser. (Avoids accidental rendering in a template for example)
const { secret } = prepareAuth(app, Object.assign({}, defaultAuthOptions, envAuthOptions))
const defaultSignInOptions = {
  dashboardUrl: '/dashboard',
  signOutUrl: '/signout'
}
prepareSignIn(app, Object.assign({}, defaultSignInOptions, envSignInOptions))

// Add any library overlays required

// Setup middleware
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Setup public files *before* the error handler
setupPublicFiles(app)

app.use(withUser(app, secret))
// Uncomment to override the user for debugging:
// const { setUser } = require('express-mustache-jwt-signin')
// app.use(setUser({username: 'user', admin: true}))

// Add routes
app.get('/', signedIn, (req, res) => {
  res.redirect(app.locals.signIn.dashboardUrl)
})
app.get(app.locals.signIn.dashboardUrl, signedIn, (req, res) => {
  res.render('content', { content: '<h1>Dashboard</h1><p>Hello!</p>', title: 'Dashboard' })
})
setupSignIn(app, secret, userManagerFromYml(app.locals.signIn.usersYml))

// Handle errors right at the end
setupErrorHandlers(app, { debug })

// Install the overlays and the template engine
const mustacheEngine = setupMustache(app)
app.engine('mustache', mustacheEngine)
app.set('views', app.locals.mustache.dirs)
app.set('view engine', 'mustache')

// Serve the app
app.listen(app.locals.option.port, () => console.log(`Example app listening on port ${app.locals.option.port}`))
