// SECRET=reallysecret DEBUG=express-mustache-jwt-signin:hash node bin/hash.js
const { hashPassword } = require('../lib/hash')

const getPass = require('getpass')
getPass.getPass((err, password) => {
  if (err) { throw err }
  hashPassword(password).then(console.log).catch(console.error)
})
