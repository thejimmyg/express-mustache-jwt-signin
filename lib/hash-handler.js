const debug = require('debug')('express-mustache-jwt-signin')
const { hashPassword } = require('../lib/hash')


const hashHandler = async (req, res, next) => {
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
    res.render('hash', { title: 'Hash', hashed, hashError, action })
  } catch (e) {
    debug(e)
    next(e)
  }
}

module.exports = {hashHandler}
