https://www.flexmls.com/developers/rets/tutorials/how-to-receive-notifications-of-feed-changes/

https://www.npmjs.com/package/aws-sdk
https://www.npmjs.com/package/rets-client

http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html
http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-making-requests.html
http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-services.html
http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-examples.html

# Docker and Node.js Best Practices

https://github.com/sbruno81/rets-client
https://milesplit.wordpress.com/2013/11/07/using-sqs-with-node/
http://www.codexpedia.com/node-js/amazon-simple-queue-service-sqs-example-in-node-js/
https://www.npmjs.com/package/sqs-consumer

https://github.com/atom-community/sync-settings
https://discuss.atom.io/t/is-there-a-method-to-import-export-settings/10616

## Environment Variables

Run with `NODE_ENV` set to `production`. This is the way you would pass in secrets and other runtime configurations to your application as well.

```
-e "NODE_ENV=production"
```

## Non-root User

By default, Docker runs container as root which inside of the container can pose as a security issue. You would want to run the container as an unprivileged user wherever possible. This is however not supported out of the box with the `node` Docker image.

```Dockerfile
FROM node:4.1.2
# Add our user and group first to make sure their IDs get assigned consistently
RUN groupadd -r app && useradd -r -g app app
```

This Docker Image can than be run with the `app` user in the following way:

```
-u "app"
```

#### Memory

By default, any Docker Container may consume as much of the hardware such as CPU and RAM. If you are running multiple containers on the same host you should limit how much memory they can consume.     

```
-m "300M" --memory-swap "1G"
```

## CMD

When creating an image, you can bypass the `package.json`'s `start` command and bake it directly into the image itself. This reduces the number of processes running inside of your container.

```Dockerfile
CMD ["node","index.js"]
```

## Docker Run

Here is an example of how you would run a default Node.JS Docker Containerized application:

```
$ docker run \
  -e "NODE_ENV=production" \
  -u "app" \
  -m "300M" --memory-swap "1G" \
  -w "/usr/src/app" \
  --name "my-nodejs-app" \
  node [script]
```

## Security

The Docker team has provided a tool to analyze your running containers for potential security issues. You can download and run this tool from here: https://github.com/docker/docker-bench-security

https://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs

# Integration Testing and Tools

Get metadata by import IDs

IMPORT_ID=565e3400b1c93c6a88000001 npm run integrateImports

# ecs-cli

http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_CLI.html

http://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_CLI_tutorial.html

`sudo curl -o /usr/local/bin/ecs-cli https://s3.amazonaws.com/amazon-ecs-cli/ecs-cli-darwin-amd64-latest`
