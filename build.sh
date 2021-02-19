#!/usr/bin/env bash

set -e

pushd server
npm install
popd

pushd web-ui
npm install
npm run build
popd
