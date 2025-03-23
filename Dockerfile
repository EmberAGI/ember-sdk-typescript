FROM node:20-slim

# Install protoc and essential build tools
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all necessary files
COPY package.json pnpm-lock.yaml ./
COPY scripts/ scripts/
COPY src/ src/
COPY tsconfig.json ./

# Make scripts executable
RUN chmod +x scripts/generate-proto.sh

# Install dependencies
RUN pnpm install

# Add required dependencies
RUN pnpm add -D long protobufjs