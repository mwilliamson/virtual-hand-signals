#!/usr/bin/env bash

set -e

pushd web-ui
npm install
npm run build
popd
cd server
npm install
