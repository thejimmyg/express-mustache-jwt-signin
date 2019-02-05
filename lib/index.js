const bodyParser = require('body-parser')
const path = require('path')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jsonwebtoken = require('jsonwebtoken')

const signInOptionsFromEnv = (scriptName) => {
  const dashboardUrl = process.env.DASHBOARD_URL
  const SIGN_IN_TITLE = process.env.SIGN_IN_TITLE || 'Sign In'
  const SIGNED_OUT_TITLE = process.env.SIGNED_OUT_TITLE || 'Sign Out'
  let HTTPS_ONLY = (process.env.HTTPS_ONLY || 'true').toLowerCase()
  if (HTTPS_ONLY === 'false') {
    HTTPS_ONLY = false
  } else {
    HTTPS_ONLY = true
    debug('Only setting cookies for HTTPS access. If you can\'t log in, make sure you are accessing the server over HTTPS.')
  }
  const signOutUrl =  process.env.SIGN_OUT_URL
  const signInUrl = process.env.SIGN_IN_URL
  const secret = process.env.SECRET
  const disableAuth = ((process.env.DISABLE_AUTH || 'false').toLowerCase() === 'true')
  const disabledAuthUser = process.env.DISABLED_AUTH_USER
  if (!secret || secret.length < 8) {
    throw new Error('No SECRET environment variable set, or the SECRET is too short. Need 8 characters')
  }
  if (!signInUrl) {
    throw new Error('No SIGN_IN_URL environment variable set')
  }
  if (!dashboardUrl) {
    throw new Error('No DASHBOARD_URL environment variable set')
  }
  if (!signOutUrl) {
    throw new Error('No SIGN_OUT_URL environment variable set')
  }
  const adminUrl = scriptName + '/admin'
  const hashUrl = scriptName + '/hash'
  return {
    disableAuth,
    disabledAuthUser,
    secret,
    hashUrl,
    adminUrl,
    signInUrl,
    signOutUrl,
    httpsOnly: HTTPS_ONLY,
    signInTitle: SIGN_IN_TITLE,
    signedOutTitle: SIGNED_OUT_TITLE,
    dashboardUrl,
    cookieName: (process.env.COOKIE_NAME || 'jwt'),
    forbiddenTitle: (process.env.FORBIDDEN_TITLE || 'Forbidden'),
    forbiddenTemplate: (process.env.FORBIDDEN_TEMPLATE || '403'),
  }
}

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

const setupMiddleware = async (app, overlays, options) => {
  const { secret, withPjaxPwa=false, signInUrl = '/user/signin', extractTokenFromRequest = extractTokenFromRequestDefault, cookieName = 'jwt', forbiddenTemplate = '403', forbiddenTitle = 'Forbidden', signOutUrl = '/user/signout', ...rest } = options || {}
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }

  if (!secret || secret.length < 8) {
    throw new Error('Invalid secret', secret)
  }
  if (typeof overlays !== 'undefined') {
    debug('Adding the express-mustache-jwt-signin overlays')
    overlays.overlayMustacheDir(path.join(__dirname, '..', 'views'))
    overlays.overlayPublicFilesDir(path.join(__dirname, '..', 'public'))
  }

  app.use((req, res, next) => {
    // debug('Setting up signOutUrl, signInUrl')
    res.locals = Object.assign({}, res.locals, { signOutUrl, signInUrl })
    next()
  })

  const signedIn = function (req, res, next) {
    debug('Checking user is signedIn with req.user:', req.user)
    if (!req.user) {
      res.redirect(signInUrl)
    } else {
      next()
    }
  }

  const withUser = async function (req, res, next) {
    // debug('Setting up withUser')
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
        res.redirect(signInUrl)
      } else {
        if (validate(req.user)) {
          next()
        } else {
          debug('Forbidden, does not have the required claims')
          res.status(403)
          res.render(forbiddenTemplate, { title: forbiddenTitle, signInUrl })
        }
      }
    }
  }

  return { withUser, signedIn, hasClaims }
}

const setupLogin = async (app, credentials, overlays, options) => {
  const { scriptName, publicUrlPath, withPjaxPwa, title } = app.locals
  if (typeof scriptName === 'undefined') {
    throw new Error(`Expected 'scriptName' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  if (typeof publicUrlPath === 'undefined') {
    throw new Error(`Expected 'publicUrlPath' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  if (typeof title === 'undefined') {
    throw new Error(`Expected 'title' to have been defined on 'app.locals' by prepareMustacheOverlays(). Perhaps you have not called prepareMustacheOverlays()?`)
  }
  const { httpsOnly = true, signedOutTemplate = 'signedOut', signedOutTitle = 'Signed Out', signInTemplate = 'signIn', cookieName = 'jwt', extractTokenFromRequest = extractTokenFromRequestDefault, signInTitle = 'Sign In', forbiddenTemplate = '402', forbiddenTitle = 'Forbidden',
    ...templateVars } = options || {}
  const { secret=secret, dashboardUrl = scriptName + '/dashboard', signOutUrl = scriptName + '/signout', adminUrl = scriptName + '/admin', hashUrl = scriptName + '/hash', signInUrl = scriptName + '/signin', ...disabled } = templateVars || {}
  const { disabledAuthUser, disableAuth, ...rest } = disabled || {}
  if (Object.keys(rest).length) {
    debug(rest)
    throw new Error('Unexpected extra options: ' + Object.keys(rest).join(', '))
  }

  // Set up our locals first so they are already available in views about to be set up by express-mustache-overlays
  app.use((req, res, next) => {
    // debug('Setting up adminUrl, hashUrl, dashboardUrl')
    res.locals = Object.assign({}, res.locals, { adminUrl, hashUrl, dashboardUrl })
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

  
  const { signedIn, withUser, hasClaims } = await setupMiddleware(app, overlays, {
secret, withPjaxPwa, signInUrl, extractTokenFromRequest, cookieName, forbiddenTemplate, forbiddenTitle, signOutUrl })

  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  app.use(withUser)

  app.all(signInUrl, async (req, res, next) => {
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
          debug('Redirecting to', dashboardUrl)
          if (withPjaxPwa) {
            return res.send(`<html><head></head><body><div id="pjax-container">Redirecting ... <script> $.pjax({url: '${dashboardUrl}', fragment: '#pjax-container', container: '#pjax-container'});</script></div></body></html>`)
          } else {
            return res.send(`<html><head><meta http-equiv="refresh" content="0; url=${dashboardUrl}"></head><body></body></html>`)
          }
        }
      }
      res.render(signInTemplate, { title: signInTitle, username, password, signInError, action, signInUrl, signOutUrl })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.all(signOutUrl, async (req, res, next) => {
    try {
      debug('Removing cookie', cookieName)
      res.cookie(cookieName, '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
      delete res.user
      delete res.locals.user
      res.render(signedOutTemplate, { title: signedOutTitle, signInUrl, signOutUrl })
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

const withAuth = async (app, overlays, signInOptions, setup) => {
  const {disableAuth, disabledAuthUser, secret, withPjaxPwa, signInUrl, extractTokenFromRequest, cookieName, forbiddenTemplate, forbiddenTitle, signOutUrl} = signInOptions
  const authMiddleware = await setupMiddleware(app, overlays, {secret, withPjaxPwa, signInUrl, extractTokenFromRequest, cookieName, forbiddenTemplate, forbiddenTitle, signOutUrl})
  const { signedIn, hasClaims } = authMiddleware
  let { withUser } = authMiddleware
  if (disableAuth) {
    withUser = makeStaticWithUser(JSON.parse(disabledAuthUser || 'null'))
  }
  app.use(withUser)
  setup(signedIn, hasClaims)
}

module.exports = { setupLogin, setupMiddleware, makeStaticWithUser, signInOptionsFromEnv, withAuth }
