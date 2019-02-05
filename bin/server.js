const express = require('express')
const fs = require('fs')
const debug = require('debug')('express-mustache-jwt-signin')
const path = require('path')
const { setupLogin, signInOptionsFromEnv, appOptionsFromEnv } = require('../lib')
const { createCredentialsFromWatchedUsersYaml } = require('../lib/loadUsers')
const { hashPassword } = require('../lib/hash')
const { overlaysOptionsFromEnv, overlaysDirsFromEnv, prepareMustacheOverlays, setupErrorHandlers } = require('express-mustache-overlays')

const port = process.env.PORT || 80
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

const overlaysOptions = overlaysOptionsFromEnv()
const { withPjaxPwa, scriptName } = overlaysOptions
const { mustacheDirs, publicFilesDirs } = overlaysDirsFromEnv()

// const scriptName = process.env.SCRIPT_NAME || ''
// const publicUrlPath = process.env.PUBLIC_URL_PATH || scriptName + '/public'
// const title = 'Express Mustache JWT Sign In'

const signInOptions = signInOptionsFromEnv()
const { signInUrl = scriptName + '/signin', signOutUrl = scriptName + '/signout' } = signInOptions
const appOptions = appOptionsFromEnv(scriptName)
const { dashboardUrl } = appOptions

const main = async () => {
  const userData = await createCredentialsFromWatchedUsersYaml(usersYml)
  const app = express()
  const overlays = await prepareMustacheOverlays(app, overlaysOptions)

  const { withUser, signedIn, hasClaims } = await setupLogin(app, secret, userData.credentials, overlays, Object.assign({}, signInOptions, appOptions, { signInUrl, signOutUrl }))
  app.use(withUser)

  app.get(scriptName + '/', (req, res) => {
    res.redirect(dashboardUrl)
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

  // Set up any other overlays directories here
  mustacheDirs.forEach(dir => {
    debug('Adding mustache dir:', dir)
    overlays.overlayMustacheDir(dir)
  })
  publicFilesDirs.forEach(dir => {
    debug('Adding public files dir:', dir)
    overlays.overlayPublicFilesDir(dir)
  })

  // Put the overlays into place after you've set up any more overlays you need, but definitely before the error handlers
  await overlays.setup()

  // Keep this right at the end, immediately before listening
  await setupErrorHandlers(app, { debug })

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGINT for docker
process.on('SIGINT', function () {
  console.log('Received SIGINT. Exiting ...')
  process.exit()
})

process.on('SIGTERM', function () {
  console.log('Received SIGTERM. Exiting ...')
  process.exit()
})
