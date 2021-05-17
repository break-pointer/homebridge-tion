#!/bin/bash

source ~/.profile
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

rm -rf ~/.homebridge/experimental/node_modules/homebridge-tion/*
tar -xzvf ~/homebridge-tion-1.0.18.tgz
cp -rf ~/package/* ~/.homebridge/experimental/node_modules/homebridge-tion
rm -rf ~/package
rm -rf ~/homebridge-tion-1.0.18.tgz
pm2 restart hb-exp