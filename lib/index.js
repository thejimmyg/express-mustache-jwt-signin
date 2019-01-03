const bodyParser = require('body-parser')
const path = require('path')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jsonwebtoken = require('jsonwebtoken')

const extractTokenFromRequestDefault = (req, cookieName) => {
  let jwtString = null
  if (req.cookies && cookieName in req.cookies) {
    jwtString = req.cookies[cookieName]
  } else if (req.headers && 'authorization' in req.headers) {
    jwtString = req.get('authorization')
    if (jwtString.toLowerCase().startsWith('bearer ')) {
      jwtString = jwtString.slice(7, jwtString.length)
    }
  }
  debug('Got JWT', jwtString)
  return jwtString
}

const setupMiddleware = async (app, secret, options) => {
  const { overlays, signInURL = '/user/signin', extractTokenFromRequest = extractTokenFromRequestDefault, cookieName = 'jwt', forbiddenTemplate = '403', forbiddenTitle = 'Forbidden', signOutURL = '/user/signout', ...rest } = options || {}
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }

  if (typeof overlays !== 'undefined') {
    debug('Adding the express-mustache-jwt-signin overlays')
    overlays.overlayMustacheDir(path.join(__dirname, '..', 'views'))
    overlays.overlayPublicFilesDir(path.join(__dirname, '..', 'public'))
  }

  app.use((req, res, next) => {
    debug('Setting up signOutURL, signInURL')
    res.locals = Object.assign({}, res.locals, { signOutURL, signInURL })
    next()
  })

  const signedIn = function (req, res, next) {
    debug('Checking user is signedIn with req.user:', req.user)
    if (!req.user) {
      res.redirect(signInURL)
    } else {
      next()
    }
  }

  const withUser = async function (req, res, next) {
    debug('Setting up withUser')
    let jwtString = await extractTokenFromRequest(req, cookieName)
    if (jwtString) {
      jsonwebtoken.verify(jwtString, secret, { algorithms: ['HS256'] }, (jwtErr, payload) => {
        if (jwtErr) {
          debug('Error verifying JWT:', jwtErr)
        } else {
          debug('credentials() payload:', payload)
          req.user = payload
          res.locals = Object.assign({}, res.locals, { user: req.user })
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

const setupLogin = async (app, secret, credentials, overlays, options) => {
  const { scriptName, publicURLPath, title } = app.locals
  if (typeof scriptName === 'undefined') {
    throw new Error(`Expected 'scriptName' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  if (typeof publicURLPath === 'undefined') {
    throw new Error(`Expected 'publicURLPath' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  if (typeof title === 'undefined') {
    throw new Error(`Expected 'title' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  const { httpsOnly = true, signedOutTemplate = 'signedOut', signedOutTitle = 'Signed Out', signInTemplate = 'signIn', cookieName = 'jwt', extractTokenFromRequest = extractTokenFromRequestDefault, signInTitle = 'Sign In', forbiddenTemplate = '403', forbiddenTitle = 'Forbidden',
    ...templateVars } = options || {}
  const { dashboardURL = scriptName + '/dashboard', signOutURL = scriptName + '/signout', adminURL = scriptName + '/admin', hashURL = scriptName + '/hash', signInURL = scriptName + '/signin', ...rest } = templateVars || {}
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }

  // Set up our locals first so theyare already available in views about to be set up by express-mustache-overlays
  app.use((req, res, next) => {
    debug('Setting up adminURL, hashURL, dashboardURL')
    res.locals = Object.assign({}, res.locals, { adminURL, hashURL, dashboardURL })
    next()
  })

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

  const { signedIn, withUser, hasClaims } = await setupMiddleware(app, secret, { overlays, signOutURL, signInURL, extractTokenFromRequest, cookieName, forbiddenTemplate, forbiddenTitle })

  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  app.use(withUser)

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
          debug('Setting cookie', cookieName, jsonWebToken, cookieOptions)
          res.cookie(cookieName, jsonWebToken, cookieOptions)
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
      debug('Removing cookie', cookieName)
      res.cookie(cookieName, '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
      delete res.user
      delete res.locals.user
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

const makeStaticWithUser = function (user) {
  return function (req, res, next) {
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

module.exports = { setupLogin, setupMiddleware, makeStaticWithUser }
