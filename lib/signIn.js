const debug = require('debug')('express-mustache-jwt-signin')
const jsonwebtoken = require('jsonwebtoken')
const path = require('path')

const setupSignIn = (app, secret, userManager) => {
  const { signInUrl, cookieName, cookieSecure } = app.locals.auth
  const { signOutUrl, dashboardUrl } = app.locals.signIn
  app.all(signInUrl, async (req, res, next) => {
    try {
      if (res.locals.user) {
        // Proceed as if we aren't signed in
        delete res.locals.user
      }
      let signInError = ''
      const action = req.path
      let username = ''
      let password = ''
      if (req.method === 'POST') {
        username = req.body.username
        password = req.body.password
        let claims
        let error = false
        try {
          const data = await userManager.credentials(username, password)
          // This allows the getUser function to actually change the username if it wants too
          claims = Object.assign({ username: username }, data)
          debug('Got full claims', claims)
        } catch (e) {
          signInError = 'Invalid credentials, please try again.'
          debug(e)
          error = true
        }
        if (!error) {
          debug('Got claims:', claims)
          // Uses the 'HS265' algorithm
          // Adds the `iat` claims too
          const jsonWebToken = jsonwebtoken.sign(claims, secret, { algorithm: 'HS256' })
          const cookieOptions = { httpOnly: true, secure: cookieSecure, signed: false }
          debug('Setting cookie', cookieName, jsonWebToken, cookieOptions)
          res.cookie(cookieName, jsonWebToken, cookieOptions)
          debug('Redirecting to', dashboardUrl)
          return res.render('signInRedirect')
        }
      }
      res.render('signIn', { title: 'Sign In', username, password, signInError, action, signInUrl, signOutUrl })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.all(signOutUrl, async (req, res, next) => {
    try {
      signOut(req, res)
      res.render('signedOut', { title: 'Signed Out', signInUrl, signOutUrl })
    } catch (e) {
      debug(e)
      next(e)
    }
  })
}

const signOut = (req, res) => {
  const { cookieName, cookieSecure } = req.app.locals.auth
  debug('Removing cookie', cookieName)
  res.cookie(cookieName, '', { httpOnly: true, secure: cookieSecure, signed: false })
  delete res.locals.user
}

const signInOptionsFromEnv = (app) => {
  const options = {}
  if (typeof process.env.DASHBOARD_URL !== 'undefined') {
    options.dashboardUrl = process.env.DASHBOARD_URL
  }
  if (typeof process.env.SIGN_OUT_URL !== 'undefined') {
    options.signOutUrl = process.env.SIGN_OUT_URL
  }
  if (typeof process.env.USERS_YML !== 'undefined') {
    options.usersYml = process.env.USERS_YML
  }
  // if (typeof process.env.SIGN_IN_PUBLIC_URL !== 'undefined') {
  //   options.signInPublicUrl = process.env.SIGN_IN_PUBLIC_URL
  // }
  return options
}

const prepareSignIn = (app, signInOptions) => {
  app.locals.mustache.overlay([path.join(__dirname, '..', 'views')])
  // app.locals.publicFiles.overlay(signInOptions.signInPublicUrl, [path.join(__dirname, '..', 'public')])
  if (!app.locals.auth.signInUrl) {
    throw new Error('No app.locals.auth.signInUrl set. Is prepareAuth() called before prepareSignIn() or did you forget to set the SIGN_IN_URL environment variable?')
  }
  if (!signInOptions.dashboardUrl) {
    debug('WARNING: Using signInOptions, but no signInOptions.dashboardUrl set. Perhaps you need to set the DASHBOARD_URL environment variable?')
  }
  if (!signInOptions.signOutUrl) {
    debug('WARNING: Using signInOptions, but no signInOptions.signOutUrl set. Perhaps you need to set the SIGN_OUT_URL environment variable?')
  }
  if (!app.locals.signIn) {
    app.locals.signIn = {}
  }
  const defaults = {
    // signInPublicUrl: '/public',
    signOutUrl: '/signout',
    dashboardUrl: '/dashboard',
    usersYml: 'users.yml'
  }
  app.locals.signIn = Object.assign(defaults, app.locals.signIn, signInOptions)
}

module.exports = { signInOptionsFromEnv, prepareSignIn, setupSignIn, signOut }
