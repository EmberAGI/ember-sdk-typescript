#!/usr/bin/env bash

submodule_dir=onchain-actions

pushd "$submodule_dir"
pnpm --ignore-workspace install
pnpm --ignore-workspace run genOpenApi
popd

# Get the absolute path of the workspace
WORKSPACE_DIR="$(pwd)"
OUTPUT_DIR="${WORKSPACE_DIR}/src/generated"

mkdir -p "$OUTPUT_DIR"

cp -r "$submodule_dir"/src/generated src/
