#!/usr/bin/env bash

submodule_dir=onchain-actions

pushd "$submodule_dir"
pnpm run genGrpc
popd

# Get the absolute path of the workspace
WORKSPACE_DIR="$(pwd)"
OUTPUT_DIR="${WORKSPACE_DIR}/src/generated"

mkdir -p "$OUTPUT_DIR"

# The parameters must be kept in sync with onchain-actions
grpc_tools_node_protoc \
    --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
    --ts_proto_out="$OUTPUT_DIR" \
    --ts_proto_opt=stringEnums=true,outputServices=grpc-js,camelCase=true,useOptionalNullable=false \
    "$submodule_dir/"*.proto
