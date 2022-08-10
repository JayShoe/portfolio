#!/bin/bash
apt-get update
apt-get -y install build-essential ntp libkrb5-dev git

# Install node:
apt-get -y install npm
ln -s /usr/bin/nodejs /usr/bin/node
npm cache clean -f
npm install -g n
n stable
npm install -g bower

mkdir -p /etc/ssl/alevo-api-keys/
chmod 777 /etc/ssl/alevo-api-keys/

