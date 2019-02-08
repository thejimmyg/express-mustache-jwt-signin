const debug = require('debug')('express-mustache-jwt-signin:credentials')
const yaml = require('js-yaml')
const fs = require('fs')
const { promisify } = require('util')
const readFileAsync = promisify(fs.readFile)
const chokidar = require('chokidar')
const _ = require('lodash')
const { validPassword } = require('../lib/hash')

const createUserDataPromise = (usersYml) => {
  return readFileAsync(usersYml, 'utf8')
    .then((data) => {
      return yaml.safeLoad(data)
    })
    .catch((e) => {
      debug(e)
      throw e
    })
}

const userManagerFromYml = (usersYml) => {
  let userDataPromise
  const onEvent = (event, path) => {
    debug('Reloading YAML files ... ', event, path)
    userDataPromise = createUserDataPromise(usersYml).then((userData) => {
      // Make the keys lowercase
      const users = {}
      for (let username in userData) {
        const lowerCaseUsername = (username + '').toLowerCase()
        if (users[lowerCaseUsername]) {
          throw new Error('Duplicate username ' + lowerCaseUsername + ' in ' + usersYml)
        }
        // Make sure everything is treated as a string.
        users[lowerCaseUsername] = userData[username]
        users[lowerCaseUsername].password = (userData[username].password + '')
      }
      return users
    })
  }
  // Get the promise created
  onEvent('init', usersYml)
  const throttledOnEvent = _.throttle(onEvent, 200, { 'trailing': true, 'leading': false })
  chokidar.watch([usersYml], { ignoreInitial: true, ignored: /(^|[/\\])\../ }).on('all', throttledOnEvent)
  return {
    getUser: async function (username) {
      const lowerCaseUsername = (username + '').toLowerCase()
      const users = await userDataPromise
      const user = users[lowerCaseUsername]
      if (typeof user === 'undefined') {
        throw new Error(`No such user ${lowerCaseUsername}.`)
      }
      return user
    },
    credentials: async function (username, password) {
      const user = await this.getUser(username)
      const hashOrPassword = user.password
      debug('Hash or password:', hashOrPassword, 'Submitted password:', password)
      if (hashOrPassword.length < 64) {
        debug('Using a password check')
        if (hashOrPassword !== password) {
          throw new Error('Invalid credentials')
        }
        return user.claims || {}
      } else {
        debug('Using a hash check')
        if ((await validPassword(hashOrPassword, password)) === false) {
          throw new Error('Invalid credentials')
        }
        return user.claims || {}
      }
    }
  }
}

module.exports = { userManagerFromYml }
