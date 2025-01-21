#!/bin/bash

# Create directories if they don't exist
mkdir -p "src/generated"

# Get the absolute path of the workspace
WORKSPACE_DIR="$(pwd)"

# Install protoc-gen-ts_proto if not already installed
pnpm add -D ts-proto

# Generate TypeScript code using ts-proto
protoc \
    --plugin="./node_modules/.bin/protoc-gen-ts_proto" \
    --ts_proto_out="${WORKSPACE_DIR}/src/generated" \
    --ts_proto_opt=outputServices=grpc-js,env=node,useOptionals=messages,exportCommonSymbols=false,esModuleInterop=true,importSuffix=.js,outputClientImpl=grpc-js \
    --proto_path="${WORKSPACE_DIR}/src/proto" \
    "${WORKSPACE_DIR}/src/proto/"*.proto 