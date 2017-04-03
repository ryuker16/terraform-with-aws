
# SNS Queue Relay

This Lambda will subscribe to new Record Created from Firehose notification 
  - Receive the message
  - Send the body of the message to a FIFO queue

# Node Version 4.3.2

*Note* - this solution works extensively with AWS Lambda, which runs in Node.js version 4.3.2. Use n (node version manager)

- check your node version `node -v`
- if not 4.3.2, use [n](https://www.npmjs.com/package/n)
- `npm install -g n`
- `sudo n 4.3.2`

# How to build and compile

- `npm install gulp-cli -g`
- `npm install`

# How to test

- `npm test`

# Deployment

Deployment uses a combination of dotenv, config, and node-aws-lambda to mangage deployment.
ts is compiled to /dist, moved to /distlambda, .env created, and gulp-install triggered from a npm install --production

- See package json for `npm run deploy` and `npm run deploy:debug`