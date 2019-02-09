# Express Mustache JWT Signin Example

You can test the example as simply as:

```
cd ../
npm install
cd example
npm install
PORT=8000 npm start
```

If you get a warning about not being able to install a package, remove your `package-lock.json` file and try again.

For production use you'll want to change the settings in the code, or use environment variables.

To see all the debug output you should run:

```
DEBUG="bootstrap-flexbox-overlay,express-render-error,express-mustache-overlays,express-public-files-overlays,express-mustache-jwt-signin,express-mustache-jwt-signin:server" PORT=8000 npm start
```

Or to log everything, use:

```
DEBUG="*" PORT=8000 npm start
```


## Docker

Docker can't copy files from a parent directory so the `docker:build` command puts the current dev version of express-mustache-jwt-signin in this directory and created a modified `package.json.docker`:

```
npm run docker:build && npm run docker:run
```

## Dev

```
npm run fix
```

### Test

Login:

```
# Success
curl -X POST -v --data "username=hello&password=world" http://localhost:8000/signin
