# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY ./ ./

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/build ./build

# Set environment variables
ENV NODE_ENV=prod
ENV PORT=5000

# Expose the port Cloud Run will use
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
