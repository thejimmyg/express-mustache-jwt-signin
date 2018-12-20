const { promisify } = require('util')
const credential = require('credential')
const debug = require('debug')('express-mustache-jwt-signin:hash')
const pw = credential({ work: 0.1 })

const hashAsync = promisify(pw.hash)
const verifyAsync = promisify(pw.verify)

async function test () {
  let hash1
  try {
    console.log('Starting...')
    const hashed = await hashPassword('password')
    console.log(hashed)
    hash1 = hashed
    const isValid = await validPassword(hashed, 'password')
    console.log(isValid)
  } catch (e) {
    debug(e)
    throw new Error('Could not hash the given password')
  }
  console.log('Starting...')
  const hashed = await hashPassword('password')
  console.log(hashed)
  if (hash1 === hashed) {
    throw new Error('Got the same hash!')
  }
  const decoded = Buffer.from(hashed, 'base64').toString('ascii')
  const data = JSON.parse(decoded)
  // Reversing the hash should always break it, a symetrical hash is very unlikely.
  const orig = data.hash
  data.hash = data.hash.split('').reverse().join('')
  if (data.hash === orig) {
    console.log(data.hash)
    throw new Error('Could not test this case since hash is symettrical')
  }
  const p = Buffer.from(JSON.stringify(data)).toString('base64')
  const isValid = (await validPassword(p, 'password') === true)
  if (isValid) {
    console.log(hashed + ' ')
    throw new Error('The invalid hash should have failed')
  }
}

async function hashPassword (password) {
  const hashed = await hashAsync(password)
  const encoded = Buffer.from(hashed).toString('base64')
  return encoded
}

async function validPassword (hash, password) {
  const decoded = Buffer.from(hash, 'base64').toString('ascii')
  const isValid = await verifyAsync(decoded, password)
  // debug(decoded, password, isValid)
  return isValid
}

module.exports = { hashPassword, validPassword, test }
// DEBUG=express-mustache-jwt-signin:hash node lib/hash.js
// test()
