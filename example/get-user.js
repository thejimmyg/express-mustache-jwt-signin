const { userManagerFromYml } = require('express-mustache-jwt-signin')
const userManager = userManagerFromYml('users.yml')
userManager.getUser('hello')
  .then(console.log)
  .catch(console.error)
  // Because the userManager is running a watch for changes, need to exit explicitly.
  .then(() => process.exit(0))
