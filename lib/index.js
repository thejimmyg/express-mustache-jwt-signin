const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jsonwebtoken = require('jsonwebtoken')

const extractTokenFromRequestDefault = (req, jwtCookieName) => {
  let jwtString = null
  if (req.cookies && jwtCookieName in req.cookies) {
    jwtString = req.cookies[jwtCookieName]
  } else if (req.headers && 'authorization' in req.headers) {
    jwtString = req.get('authorization')
    if (jwtString.toLowerCase().startsWith('bearer ')) {
      jwtString = jwtString.slice(7, jwtString.length)
    }
  }
  debug('Got JWT', jwtString)
  return jwtString
}

const scriptName = process.env.SCRIPT_NAME || ''
const SIGN_IN_URL = process.env.SIGN_IN_URL || scriptName + '/signin'
const DASHBOARD_URL = process.env.DASHBOARD_URL || scriptName + '/dashboard'
const COOKIE_NAME = process.env.COOKIE_NAME || 'jwt'
const FORBIDDEN_TEMPLATE = process.env.FORBIDDEN_TEMPLATE || '403'
const FORBIDDEN_TITLE = process.env.FORBIDDEN_TITLE || 'Forbidden'
let HTTPS_ONLY = (process.env.HTTPS_ONLY || 'true').toLowerCase()
if (HTTPS_ONLY === 'false') {
  HTTPS_ONLY = false
} else {
  HTTPS_ONLY = true
  debug('Only setting cookies for HTTPS access. If you can\'t log in, make sure you are accessing the server over HTTPS.')
}

const setupMiddleware = (secret, options) => {
  const { signInURL = SIGN_IN_URL, extractTokenFromRequest = extractTokenFromRequestDefault, jwtCookieName = COOKIE_NAME, forbiddenTemplate = FORBIDDEN_TEMPLATE, forbiddenTitle = FORBIDDEN_TITLE, ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error('Unexpected extra options: ' + Object.keys({ rest }).join(', '))
  }

  const signedIn = function (req, res, next) {
    debug(req.user)
    if (!req.user) {
      res.redirect(signInURL)
    } else {
      next()
    }
  }

  const withUser = async function (req, res, next) {
    let jwtString = await extractTokenFromRequest(req, jwtCookieName)
    if (jwtString) {
      jsonwebtoken.verify(jwtString, secret, { algorithms: ['HS256'] }, (jwtErr, payload) => {
        if (jwtErr) {
          debug('Error verifying JWT:', jwtErr)
        } else {
          debug(payload)
          req.user = payload
        }
      })
    }
    next()
  }

  const hasClaims = function (validate) {
    return function (req, res, next) {
      debug('Checking for claims')
      if (!req.user) {
        res.redirect(signInURL)
      } else {
        if (validate(req.user)) {
          next()
        } else {
          debug('Forbidden, does not have the required claims')
          res.status(403)
          res.render(forbiddenTemplate, { title: forbiddenTitle, signInURL })
        }
      }
    }
  }

  return { withUser, signedIn, hasClaims }
}

const setupLogin = (app, secret, credentials, options) => {
  const { httpsOnly = HTTPS_ONLY, dashboardURL = DASHBOARD_URL, signedOutTemplate = 'signedOut', signInTemplate = 'signIn', signedOutTitle = 'Signed Out', signInTitle = 'Sign In', jwtCookieName = COOKIE_NAME, extractTokenFromRequest = extractTokenFromRequestDefault, signOutURL = scriptName + '/signout', signInURL = SIGN_IN_URL, forbiddenTemplate = FORBIDDEN_TEMPLATE, forbiddenTitle = FORBIDDEN_TITLE, ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error('Unexpected extra options: ' + Object.keys({ rest }).join(', '))
  }

  let getUser = credentials
  if (typeof credentials !== 'function') {
    getUser = function (username, password) {
      const c = credentials[username]
      if (Object.keys(c).length > 0 && ((c['password'] + '') === password)) {
        const jwtData = Object.assign({ username: username }, c['claims'])
        debug('Setting jwtData', jwtData)
        return jwtData
      } else {
        throw new Error('Invalid username or password')
      }
    }
  }

  const { signedIn, withUser, hasClaims } = setupMiddleware(secret, { signInURL, extractTokenFromRequest, jwtCookieName, forbiddenTemplate, forbiddenTitle })
  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  app.all(signInURL, async (req, res, next) => {
    try {
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
          // This allows the getUser function to actually change the username if it wants too
          claims = Object.assign({ username: username }, (await getUser(username, password)))
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
          const cookieOptions = { httpOnly: true, secure: httpsOnly, signed: false }
          debug('Setting cookie', jwtCookieName, jsonWebToken, cookieOptions)
          res.cookie(jwtCookieName, jsonWebToken, cookieOptions)
          debug('Redirecting to', dashboardURL)
          return res.send(`<html><head><meta http-equiv="refresh" content="0; url=${dashboardURL}"></head><body></body></html>`)
        }
      }
      res.render(signInTemplate, { title: signInTitle, username, password, signInError, action, signInURL, signOutURL })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.all(signOutURL, async (req, res, next) => {
    try {
      debug('Removing cookie', jwtCookieName)
      res.cookie(jwtCookieName, '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
      res.render(signedOutTemplate, { title: signedOutTitle, signInURL, signOutURL })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  return {
    signedIn, withUser, hasClaims
  }
}

module.exports = { setupLogin, setupMiddleware }
