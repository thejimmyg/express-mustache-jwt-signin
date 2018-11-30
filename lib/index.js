const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jwt = require('jsonwebtoken')

const getTokenDefault = (req, jwtCookieName) => {
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
  const { dashboardURL = '/dashboard', jwtCookieName = 'jwt', getToken = getTokenDefault, signOutURL = '/signout', signInURL = '/signin' } = options || {}

  const signedIn = (req, res, next) => {
    debug(req.user)
    if (!req.user) {
      res.redirect(signInURL)
    } else {
      next()
    }
  }

  const withUser = (req, res, next) => {
    let jwtString = getToken(req, jwtCookieName)
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

  app.all(signInURL, (req, res) => {
    let signinError = ''
    const action = req.path
    let username = ''
    let password = ''
    if (req.method === 'POST') {
      username = req.body.username
      password = req.body.password
      if ((credentials[username] + '') === (password + '')) {
        const user = {
          username,
          role: 'admin'
        }
        const jsonWebToken = jwt.sign({ user }, secret)
        debug('Setting cookie', jwtCookieName, jsonWebToken)
        res.cookie(jwtCookieName, jsonWebToken, { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
        debug('Redirecting to', dashboardURL)
        return res.send(`<html><head><meta http-equiv="refresh" content="0; url=${dashboardURL}"></head><body></body></html>`)
      } else {
        signinError = 'Invalid credentials, please try again.'
      }
    }
    res.render('signin', { title: 'Sign In', username, password, signinError, action })
  })

  app.all(signOutURL, (req, res) => {
    debug('Removing cookie', jwtCookieName)
    res.cookie(jwtCookieName, '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: false })
    res.render('signedout', { title: 'Signed Out' })
  })

  return {
    signedIn, withUser
  }
}

module.exports = { setupLogin }
