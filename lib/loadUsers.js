const debug = require('debug')('express-mustache-jwt-signin:credentials')
const yaml = require('js-yaml')
const fs = require('fs')
const { promisify } = require('util')
const readFileAsync = promisify(fs.readFile)
const chokidar = require('chokidar')
const _ = require('lodash')
const { validPassword } = require('../lib/hash')

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
  const throttledOnEvent = _.throttle(onEvent, 200, { 'trailing': true, 'leading': false })
  chokidar.watch([usersYml], { ignoreInitial: true, ignored: /(^|[/\\])\../ }).on('all', throttledOnEvent)

  const isValid = async (hashOrPassword, password) => {
    debug('Hash or password:', hashOrPassword, 'Submitted password:', password)
    if (hashOrPassword.length < 64) {
      debug('Using a password check')
      return hashOrPassword === password
    } else {
      try {
        debug('Using a hash check')
        return (await validPassword(hashOrPassword, password) === true)
      } catch (e) {
        debug(e)
        return false
      }
    }
  }

  async function credentials (username, password) {
    const lowerCaseUsername = username.toLowerCase()
    const hashOrPassword = self.passwords[lowerCaseUsername]
    if (hashOrPassword.length && await isValid(hashOrPassword, password)) {
      debug('Successful login')
      const claims = self.users[lowerCaseUsername]['claims'] || {}
      debug('Claims from', usersYml, ':', claims)
      return claims
    }
    debug('Failed login')
    throw new Error('Invalid credentials')
  }

  self.credentials = credentials
  return self
}

module.exports = { createCredentialsFromWatchedUsersYaml }
