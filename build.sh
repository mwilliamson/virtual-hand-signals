#!/usr/bin/env bash

set -e

pushd server
NPM_CONFIG_PRODUCTION=false npm install
npm run build
popd

pushd web-ui
npm install
npm run build
popd
