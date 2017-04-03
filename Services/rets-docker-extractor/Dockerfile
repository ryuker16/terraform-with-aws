FROM node:6.10

# https://github.com/yarnpkg/yarn/issues/2828
RUN yarn global add node-gyp

# Create app directory
RUN mkdir -p /opt/placester/app
WORKDIR /opt/placester/app

# Make ssh dir
RUN mkdir /root/.ssh

# Copy over private key, and set permissions
ADD config/id_rsa /root/.ssh/id_rsa
RUN chmod 700 /root/.ssh/id_rsa
RUN chown -R root:root /root/.ssh

# Create known_hosts
RUN touch /root/.ssh/known_hosts

# Add github (or your git server) fingerprint to known hosts
RUN ssh-keyscan -t rsa github.com >> /root/.ssh/known_hosts

# Install app dependencies package.json and npm-shrinkwrap.json
COPY *.json yarn.lock /opt/placester/app/
RUN yarn install --production
RUN ls -ral node_modules

# Bundle app source from gulp build
ADD distlib /opt/placester/app
RUN ls -ral

# Bundle configuration source
ADD config/*.json /opt/placester/app/config/
RUN ls -ral config

# Cleanup
RUN rm /root/.ssh/id_rsa

CMD ["node", "index.js"]