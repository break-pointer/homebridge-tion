#!/bin/bash

rm -rf ./dist 
rm -f ./homebridge-tion-1.0.9.tgz 
npm run build 
npm pack 
scp ./homebridge-tion-1.0.9.tgz home@10.1.1.5:/home/home
ssh home@10.1.1.5 'bash -s' < ./deploy/update.sh