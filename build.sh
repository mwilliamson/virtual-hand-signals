#!/usr/bin/env bash

set -e

pushd server
npm install --production=false
npm run build
popd

pushd web-ui
npm install --production=false
npm run build
popd
