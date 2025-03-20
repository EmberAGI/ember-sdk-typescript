#!/usr/bin/env bash

set -e

submodule_dir=onchain-actions

git submodule status "$submodule_dir" \
    | grep -Eq '\s*[a-f0-9]{40}' \
    || (
    echo "initialize git submodule first! $submodule_dir submodule is not pointing to a revision" && exit 1
)

pushd  "$submodule_dir"

pnpm install 1>/dev/null

popd
