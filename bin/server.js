const express = require('express')
const fs = require('fs')
const debug = require('debug')('express-mustache-jwt-signin')
const setupMustache = require('express-mustache-overlays')
const path = require('path')
const { setupLogin } = require('../lib')
const { createCredentialsFromWatchedUsersYaml } = require('../lib/loadUsers')
const { hashPassword } = require('../lib/hash')

const scriptName = process.env.SCRIPT_NAME || ''
if (scriptName.endsWith('/')){
  throw new Error('SCRIPT_NAME should not end with /.')
}
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
const mustacheDirs = process.env.MUSTACHE_DIRS ? process.env.MUSTACHE_DIRS.split(':') : []
mustacheDirs.push(path.join(__dirname, '..', 'views'))

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
  const { withUser, signedIn, hasClaims } = setupLogin(app, secret, userData.credentials)

  const adminURL = scriptName + '/admin'
  const dashboardURL = scriptName + '/dashboard'
  const hashURL = scriptName + '/hash'

  const templateDefaults = { title: 'Title', scriptName, dashboardURL, hashURL, adminURL, signOutURL: scriptName + '/signout', signInURL: scriptName + '/signin' }
  await setupMustache(app, templateDefaults, mustacheDirs)

  // Make req.user available to everything
  app.use(withUser)

  app.get(scriptName + '/', (req, res) => {
    res.redirect(dashboardURL)
  })

  app.get(scriptName + '/dashboard', signedIn, async (req, res, next) => {
    try {
      res.render('main', { title: 'Dashboard', user: req.user, content: '<h1>Dashboard</h1><p>Not much to see here.</p>' })
    } catch (e) {
      debug(e)
      next(e)
    }
  })

  app.get(scriptName + '/admin', hasClaims(claims => claims.admin), async (req, res, next) => {
    try {
      res.render('main', { title: 'Admin', user: req.user, content: '<h1>Admin</h1><p>Only those with the <tt>admin</tt> claim set to <tt>true</tt> can see this.</p>' })
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
        let error = false
        if (!password.length) {
          hashError = 'Please enter a password'
          error = true
        } else if (password !== confirmPassword) {
          hashError = 'Passwords must match'
          error = true
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

  app.use(express.static(path.join(__dirname, '..', 'public')))

  // Must be after other routes - Handle 404
  app.get('*', (req, res) => {
    res.status(404)
    res.render('404', { user: req.user })
  })

  // Error handler has to be last
  app.use(function (err, req, res, next) {
    debug('Error:', err)
    res.status(500)
    try {
      res.render('500', { user: req.user, scriptName })
    } catch (e) {
      debug('Error during rendering 500 page:', e)
      res.send('Internal server error.')
    }
  })

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGNIN for docker
process.on('SIGINT', function () {
  console.log('Exiting ...')
  process.exit()
})
