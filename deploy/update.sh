#!/bin/bash

source ~/.profile
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

rm -rf ~/.homebridge/stable/node_modules/homebridge-tion/*
tar -xzvf ~/homebridge-tion-1.0.9.tgz
cp -rf ~/package/* ~/.homebridge/stable/node_modules/homebridge-tion
rm -rf ~/package
rm -rf ~/homebridge-tion-1.0.9.tgz
pm2 restart hb-stable