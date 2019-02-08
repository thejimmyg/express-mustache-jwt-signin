module.exports = Object.assign(
  {},
  require('./prepare'),
  require('./auth'),
  require('./signIn'),
  require('./hash'),
  require('./usersFile')
)
