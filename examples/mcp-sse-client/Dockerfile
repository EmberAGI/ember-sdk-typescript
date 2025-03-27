# Use a Node.js base image
FROM node:20-slim  

# Set working directory
WORKDIR /app  

# Install pnpm globally
RUN npm install -g pnpm  

# Copy package.json and pnpm-lock.yaml first to leverage Docker cache
COPY package.json  ./  

# Install dependencies
RUN pnpm install --no-frozen-lockfile  

# Explicitly install TypeScript locally in the project
RUN pnpm add -D typescript tsx

# Ensure TypeScript is installed and available globally
RUN npx tsc --version  

# Copy all project files
COPY . .  


# Expose port for SSE MCP Client
EXPOSE 3002  

# Start the SSE MCP client
CMD ["pnpm", "start:sse"]
