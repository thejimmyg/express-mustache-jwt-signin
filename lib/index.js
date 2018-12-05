const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jwt = require('jsonwebtoken')

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

const setupLogin = (app, secret, credentials, options) => {
  const { dashboardURL = '/user/dashboard', jwtCookieName = 'jwt', extractTokenFromRequest = extractTokenFromRequestDefault, signOutURL = '/user/signout', signInURL = '/user/signin', ...rest } = options || {}
  if (Object.keys(rest).length) {
    throw new Error('Unexpected extra options: ' + Object.keys({ rest }).join(', '))
  }

  let getUser = credentials
  if (typeof credentials !== 'function') {
    getUser = function (username, password) {
      const c = credentials[username]
      if (c && ((c['password'] + '') === password)) {
        return Object.assign({ username: username }, c['claims'])
      } else {
        throw new Error('Invalid username or password')
      }
    }
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
      jwt.verify(jwtString, secret, {}, (jwtErr, payload) => {
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

  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  app.all(signInURL, async (req, res) => {
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
      } catch (e) {
        signInError = 'Invalid credentials, please try again.'
        debug(e.toString())
        error = true
      }
      if (!error) {
        debug('Got claims:', claims)
        // Uses the 'HS265' algorithm only by default
        // Adds the iat claims too
        const jsonWebToken = jwt.sign(claims, secret)
        debug('Setting cookie', jwtCookieName, jsonWebToken)
        res.cookie(jwtCookieName, jsonWebToken, { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
        debug('Redirecting to', dashboardURL)
        return res.send(`<html><head><meta http-equiv="refresh" content="0; url=${dashboardURL}"></head><body></body></html>`)
      }
    }
    res.render('signin', { title: 'Sign In', username, password, signInError, action, signInURL, signOutURL })
  })

  app.all(signOutURL, (req, res) => {
    debug('Removing cookie', jwtCookieName)
    res.cookie(jwtCookieName, '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
    res.render('signedout', { title: 'Signed Out', signInURL, signOutURL })
  })

  return {
    signedIn, withUser
  }
}

module.exports = { setupLogin }
