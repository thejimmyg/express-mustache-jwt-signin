const express = require('express')
const fs = require('fs')
const debug = require('debug')('express-mustache-jwt-signin')
const path = require('path')
const { setupLogin, signInOptionsFromEnv, appOptionsFromEnv } = require('../lib')
const { createCredentialsFromWatchedUsersYaml } = require('../lib/loadUsers')
const { hashPassword } = require('../lib/hash')
const { overlaysOptionsFromEnv, withOverlays, setupErrorHandlers } = require('express-mustache-overlays')

const usersYml = process.env.USERS_YML || path.join(__dirname, '..', 'yaml', 'users.yml')
const stat = fs.statSync(usersYml)
if (!(stat && stat.isFile())) {
  throw new Error(`No such users file '${usersYml}'. Please check USERS_YML.`)
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
const { scriptName, port } = overlaysOptions
const signInOptions = signInOptionsFromEnv( scriptName )
const { dashboardUrl, adminUrl, hashUrl, secret } = signInOptions

const main = async () => {
  const userData = await createCredentialsFromWatchedUsersYaml(usersYml)
  const app = express()

  await withOverlays(app, overlaysOptions, async (overlays) => {
    const { withUser, signedIn, hasClaims } = await setupLogin(app, userData.credentials, overlays, signInOptions)
    app.use(withUser)

    app.get(scriptName + '/', (req, res) => {
      res.redirect(dashboardUrl)
    })

    app.get(dashboardUrl, signedIn, async (req, res, next) => {
      try {
        res.render('content', { title: 'Dashboard', user: req.user, content: '<h1>Dashboard</h1><p>Not much to see here.</p>' })
      } catch (e) {
        debug(e)
        next(e)
      }
    })

    app.get(adminUrl, hasClaims(claims => claims.admin), async (req, res, next) => {
      try {
        res.render('content', { title: 'Admin', user: req.user, content: '<h1>Admin</h1><p>Only those with the <tt>admin</tt> claim set to <tt>true</tt> can see this.</p>' })
      } catch (e) {
        debug(e)
        next(e)
      }
    })

    app.all(hashUrl, hasClaims(claims => claims.admin), async (req, res, next) => {
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
    await setupErrorHandlers(app, { debug })
  })

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
