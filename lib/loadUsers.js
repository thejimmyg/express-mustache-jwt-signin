const debug = require('debug')('express-mustache-jwt-signin')
const yaml = require('js-yaml')
const fs = require('fs')
const { promisify } = require('util')
const readFileAsync = promisify(fs.readFile)
const chokidar = require('chokidar')
const _ = require('lodash')

const createCredentialsFromWatchedUsersYaml = async function (usersYml) {
  const self = { passwords: {}, users: {} }

  const load = async () => {
    // Get document, or throw exception on error
    let userData = ''
    try {
      userData = yaml.safeLoad(await readFileAsync(usersYml, 'utf8'))
    } catch (e) {
      debug(e)
      console.error(e)
      debug('Continuing anyway, with no user data in case the file has just been removed and is about to be replaced ...')
    }
    const passwords = {}
    const users = {}
    for (let username in userData) {
      const lowerCaseUsername = (username + '').toLowerCase()
      if (passwords[lowerCaseUsername]) {
        throw new Error('Duplicate username ' + lowerCaseUsername + ' in ' + usersYml)
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
  const onEvent = async (event, path) => {
    debug('Reloading YAML files ... ', event, path)
    await load()
    debug(self.passwords, self.users)
  }
  const throttledOnEvent = _.throttle(onEvent, 500, { 'trailing': true, 'leading': false })
  chokidar.watch([usersYml], { ignored: /(^|[/\\])\../ }).on('all', throttledOnEvent)

  async function credentials (username, password) {
    const lowerCaseUsername = username.toLowerCase()
    if (self.passwords[lowerCaseUsername] && (self.passwords[lowerCaseUsername] === password)) {
      const claims = self.users[lowerCaseUsername]['claims'] || {}
      debug('Claims from', usersYml, ':', claims)
      return claims
    }
    throw new Error('Invalid credentials')
  }

  self.credentials = credentials
  return self
}

module.exports = { createCredentialsFromWatchedUsersYaml }
