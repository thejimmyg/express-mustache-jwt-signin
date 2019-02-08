const debug = require('debug')('express-mustache-jwt-signin')
const jsonwebtoken = require('jsonwebtoken')

const authOptionsFromEnv = (app) => {
  const options = {}
  if (typeof process.env.COOKIE_SECURE !== 'undefined') {
    let cookieSecure = (process.env.COOKIE_SECURE || 'true').toLowerCase()
    if (cookieSecure === 'false') {
      options.cookieSecure = false
    } else {
      options.cookieSecure = true
      debug('Only setting cookies for HTTPS access. If you can\'t log in, make sure you are accessing the server over HTTPS.')
    }
  }
  if (typeof process.env.SIGN_IN_URL !== 'undefined') {
    options.signInUrl = process.env.SIGN_IN_URL
  }
  if (typeof process.env.SECRET !== 'undefined') {
    options.secret = process.env.SECRET
  }
  if (typeof process.env.COOKIE_NAME !== 'undefined') {
    options.cookieName = process.env.COOKIE_NAME
  }
  return options
}

const signedIn = function (req, res, next) {
  const { auth } = req.app.locals
  debug('Checking user is signedIn with res.locals.user:', res.locals.user)
  if (!res.locals.user) {
    res.redirect(auth.signInUrl)
  } else {
    next()
  }
}

const withUser = (app, secret) => {
  if (!app || !secret) {
    throw new Error('Please set both app and options')
  }
  return function (req, res, next) {
    const auth = req.app.locals.auth
    debug('Setting up withUser')
    let jwtString = null
    if (req.cookies && auth.cookieName in req.cookies) {
      jwtString = req.cookies[auth.cookieName]
    } else if (req.headers && 'authorization' in req.headers) {
      jwtString = req.get('authorization')
      if (jwtString.toLowerCase().startsWith('bearer ')) {
        jwtString = jwtString.slice(7, jwtString.length)
      }
    }
    debug('Got JWT', jwtString)
    if (jwtString) {
      jsonwebtoken.verify(jwtString, secret, { algorithms: ['HS256'] }, (jwtErr, payload) => {
        if (jwtErr) {
          debug('Error verifying JWT:', jwtErr)
        } else {
          debug('credentials() payload:', payload)
          res.locals.user = payload
        }
      })
    }
    next()
  }
}

const hasClaims = (validate) => {
  return (req, res, next) => {
    debug('Checking for claims')
    const { auth } = req.app.auth
    if (!res.locals.user) {
      res.redirect(req.app.locals.auth.signInUrl)
    } else {
      if (validate(res.locals.user)) {
        next()
      } else {
        debug('Forbidden, does not have the required claims')
        res.status(403)
        res.render('403', { title: 'Forbidden', signInUrl: auth.signInUrl })
      }
    }
  }
}

const setUser = function (user) {
  return function (req, res, next) {
    debug('Caution, disabling auth, and just using a static user')
    try {
      debug('Using', user, 'as user')
      res.locals.user = req.user = user
      next()
    } catch (e) {
      debug(e)
      next(e)
    }
  }
}

const prepareAuth = (app, authOptions) => {
  if (!authOptions.secret || authOptions.secret.length < 8) {
    throw new Error('No authOptions.secret set or the SECRET is too short. Need 8 characters. Perhaps the SECRET environment variable is not set correctly?')
  }
  if (!authOptions.signInUrl) {
    throw new Error('No authOptions.signInUrl set. Did you forget to set the SIGN_IN_URL environment variable?')
  }
  if (!app.locals.auth) {
    app.locals.auth = {}
  }
  // Setup the defaults
  Object.assign(app.locals.auth, { cookieName: 'jwt', cookieSecure: true, signInUrl: '/signout' })
  // Override the defaults, but don't set secret
  for (let k in authOptions) {
    if (k !== 'secret' && authOptions.hasOwnProperty(k)) {
      app.locals.auth[k] = authOptions[k]
    }
  }
  // TODO: Validate options here
  return { secret: authOptions.secret }
}

module.exports = { authOptionsFromEnv, prepareAuth, withUser, signedIn, hasClaims, setUser }
