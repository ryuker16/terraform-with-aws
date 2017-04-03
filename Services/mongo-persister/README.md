# Data-Services-ETL
The next generation microservice-based ETL Platform

# Configuration

codeship.plinternal.env includes the following .env variables interacting with gulp.deploy.js

- LOGGER_AWS_ACCESS_KEY
- LOGGER_AWS_ACCESS_SECRET
- MONGO_CONNECTION
- PERSISTER_QUEUE_URL interpreted by AWS_DEFAULT_REGION and AWS_ACCOUNT_ID and TF_VAR_prefix

## Mongo-Persister

Currently, the persister will be a scheduled lambda 
- read from an SQS queue with `QueueConsumer`
  - bulk upsert into placester_production.listings using a hash ObjectId based on import_id and feed_id of the canonical transformed document 

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