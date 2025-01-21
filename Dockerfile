FROM node:20-slim

# Install protoc and essential build tools
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json ./

# Create empty pnpm-lock.yaml if it doesn't exist
RUN touch pnpm-lock.yaml

# Install dependencies
RUN pnpm install

# Add required dependencies
RUN pnpm add -D long protobufjs

# The source files will be mounted at runtime 