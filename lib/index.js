const JwtCookieComboStrategy = require('passport-jwt-cookiecombo')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const debug = require('debug')('express-mustache-jwt-signin')
const jwt = require('jsonwebtoken')
const passport = require('passport')

const signedIn = passport.authenticate('jwt-cookiecombo', { failureRedirect: '/signin', session: false })

function withUser (req, res, next) {
  passport.authenticate('jwt-cookiecombo', { session: false }, function (err, user) {
    if (err) console.error(err)
    req.user = user
    next()
  })(req, res)
}

const setupLogin = (app, secret, credentials, dashboardURL) => {
  app.use(cookieParser(secret)) // I don't think this should be the same

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))

  passport.use(new JwtCookieComboStrategy(
    { secretOrPublicKey: secret, jwtCookieName: 'jwt' },
    // Verify
    (payload, done) => {
      // Maybe go to db to get extra info about the user?
      return done(null, payload.user)
    })
  )

  app.all('/signin', (req, res) => {
    let signinError = ''
    const action = req.path
    let username = ''
    let password = ''
    if (req.method === 'POST') {
      username = req.body.username
      password = req.body.password
      if (credentials[username] === password) {
        const user = {
          username,
          role: 'admin'
        }
        const jsonWebToken = jwt.sign({ user }, secret)
        res.cookie('jwt', jsonWebToken, { httpOnly: true, secure: process.NODE_ENV === 'production', signed: true })
        debug('Redirecting to', dashboardURL)
        return res.send(`<html><head><meta http-equiv="refresh" content="0; url=${dashboardURL}"></head><body></body></html>`)
      } else {
        signinError = 'Invalid credentials, please try again.'
      }
    }
    res.render('signin', { title: 'Sign In', username, password, signinError, action })
  })

  app.all('/signout', (req, res) => {
    res.cookie('jwt', '', { httpOnly: true, secure: process.NODE_ENV === 'production', signed: true })
    res.render('signedout', { title: 'Signed Out' })
  })
}

module.exports = {
  signedIn,
  withUser,
  setupLogin
}
