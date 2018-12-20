const express = require('express')
const fs = require('fs')
const debug = require('debug')('express-mustache-jwt-signin')
const path = require('path')

// Change the MUSTACHE_DIRS variable to use the views directory if neccessary
const MUSTACHE_DIRS = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
MUSTACHE_DIRS.push(path.normalize(path.join(__dirname, '..', 'views')))
process.env.MUSTACHE_DIRS = MUSTACHE_DIRS.join(':')
// Change the PUBLIC_FILES_DIRS variable to use the views directory if neccessary
const PUBLIC_FILES_DIRS = process.env.PUBLIC_FILES_DIRS ? process.env.PUBLIC_FILES_DIRS.split(':') : []
PUBLIC_FILES_DIRS.push(path.normalize(path.join(__dirname, '..', 'public')))
process.env.PUBLIC_FILES_DIRS = PUBLIC_FILES_DIRS.join(':')

const { setupMustacheOverlays, setupErrorHandlers } = require('express-mustache-overlays')
const { setupLogin } = require('../lib')
const { createCredentialsFromWatchedUsersYaml } = require('../lib/loadUsers')
const { hashPassword } = require('../lib/hash')

const port = process.env.PORT || 9005
const usersYml = process.env.USERS_YML || path.join(__dirname, '..', 'yaml', 'users.yml')
const stat = fs.statSync(usersYml)
if (!(stat && stat.isFile())) {
  throw new Error(`No such users file '${usersYml}'. Please check USERS_YML.`)
}
const secret = process.env.SECRET
if (!secret || secret.length < 8) {
  throw new Error('No SECRET environment variable set, or the SECRET is too short. Need 8 characters')
}
// const credentials = {
//   'hello': { password: 'world', claims: {'admin': true} }
// }
//
// or
//
// async function credentials (username, password) {
//   if (username === 'hello' && password === 'world') {
//     return { 'admin': true }
//   }
//   throw new Error('Invalid credentials')
// }
//
// or
//
// Use the createCredentialsFromWatchedUsersYaml to specify users in a yaml file as we do here.

const main = async () => {
  const userData = await createCredentialsFromWatchedUsersYaml(usersYml)

  const app = express()
  const { scriptName, publicURLPath } = await setupMustacheOverlays(app)

  const adminURL = scriptName + '/admin'
  const dashboardURL = scriptName + '/dashboard'
  const hashURL = scriptName + '/hash'

  app.use((req, res, next) => {
    debug('Setting up locals')
    res.locals = Object.assign({}, res.locals, { publicURLPath, scriptName, title: 'Express Mustache JWT Sign In', dashboardURL, hashURL, adminURL, signOutURL: scriptName + '/signout', signInURL: scriptName + '/signin' })
    next()
  })

  const { withUser, signedIn, hasClaims } = setupLogin(app, secret, userData.credentials)
  app.use(withUser)

  app.use((req, res, next) => {
    debug('Setting up user locals')
    res.locals = Object.assign({}, res.locals, { user: req.user })
    next()
  })

  app.get(scriptName + '/', (req, res) => {
    res.redirect(dashboardURL)
  })

  app.get(scriptName + '/dashboard', signedIn, async (req, res, next) => {
    try {
      res.render('content', { title: 'Dashboard', user: req.user, content: '<h1>Dashboard</h1><p>Not much to see here.</p>' })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.get(scriptName + '/admin', hasClaims(claims => claims.admin), async (req, res, next) => {
    try {
      res.render('content', { title: 'Admin', user: req.user, content: '<h1>Admin</h1><p>Only those with the <tt>admin</tt> claim set to <tt>true</tt> can see this.</p>' })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.all(scriptName + '/hash', hasClaims(claims => claims.admin), async (req, res, next) => {
    try {
      let hashError = ''
      const action = req.path
      let password = ''
      let confirmPassword = ''
      let hashed = ''
      if (req.method === 'POST') {
        password = req.body.password
        confirmPassword = req.body.confirm_password
        if (!password.length) {
          hashError = 'Please enter a password'
        } else if (password !== confirmPassword) {
          hashError = 'Passwords must match'
        } else {
          hashed = await hashPassword(password)
        }
      }
      res.render('hash', { title: 'Hash', user: req.user, hashed, hashError, action })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  // Keep this right at the end, immediately before listening
  setupErrorHandlers(app)

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGNIN for docker
process.on('SIGINT', function () {
  console.log('Exiting ...')
  process.exit()
})
