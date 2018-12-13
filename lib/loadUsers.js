const debug = require('debug')('express-mustache-jwt-signin')
const yaml = require('js-yaml')
const fs = require('fs')
const { promisify } = require('util')
const readFileAsync = promisify(fs.readFile)
const chokidar = require('chokidar')

const createCredentialsFromWatchedUsersYaml = async function (passwordsYamlPath) {
  const self = { passwords: {}, users: {} }

  const load = async () => {
    // Get document, or throw exception on error
    const userData = yaml.safeLoad(await readFileAsync(passwordsYamlPath, 'utf8'))
    const passwords = {}
    const users = {}
    for (let username in userData) {
      const lowerCaseUsername = (username + '').toLowerCase()
      if (passwords[lowerCaseUsername]) {
        throw new Error('Duplicate username '+lowerCaseUsername+' in ' + passwordsYamlPath)
      }
      // Make sure everything is treated as a string.
      passwords[lowerCaseUsername] = (userData[username]['password'] + '')
      users[lowerCaseUsername] = userData[username]
    }
    self.passwords = passwords
    self.users = users
  }

  await load()
  debug(self.passwords, self.users)

  chokidar.watch([passwordsYamlPath]).on('change', async (event, path) => {
    debug('Reloading YAML files ... ', event, path)
    await load()
    debug(self.passwords, self.users)
  })

  async function credentials (username, password) {
    const lowerCaseUsername = username.toLowerCase()
    if (self.passwords[lowerCaseUsername] && (self.passwords[lowerCaseUsername] === password)) {
      const claims = self.users[lowerCaseUsername]['claims'] || {}
      debug('Claims from', passwordsYamlPath, ':', claims)
      return claims
    }
    throw new Error('Invalid credentials')
  }

  self.credentials = credentials
  return self
}

module.exports = { createCredentialsFromWatchedUsersYaml }
