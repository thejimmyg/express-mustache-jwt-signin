const express = require('express')
const debug = require('debug')('express-mustache-jwt-signin')
const setupMustache = require('express-mustache-overlays')
const path = require('path')
const { setupLogin } = require('../lib')

const port = process.env.PORT || 9005
const secret = process.env.SECRET
if (!secret || secret.length < 8) {
  throw new Error('No SECRET environment variable set, or the SECRET is too short. Need 8 characters')
}
const templateDefaults = { title: 'Title' }
const mustacheDirs = path.join(__dirname, '..', 'views')
const credentials = {
  'hello': 'world'
}

const main = async () => {
  const app = express()
  const { withUser, signedIn } = setupLogin(app, secret, credentials)

  await setupMustache(app, templateDefaults, mustacheDirs)

  // Make req.user available to everything
  app.use(withUser)

  app.get('/', (req, res) => {
    res.render('main', { user: req.user, content: '<h1>Home</h1><p>Hello!</p>' })
  })

  app.get('/dashboard', signedIn, (req, res) => {
    res.render('main', { title: 'Dashboard', user: req.user, content: '<h1>Dashboard</h1><p>Not much to see here.</p>' })
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
    res.status(500).send('Something broke!')
  })

  app.listen(port, () => console.log(`Example app listening on port ${port}`))
}

main()

// Better handling of SIGNIN for docker
process.on('SIGINT', function () {
  console.log('Exiting ...')
  process.exit()
})
