FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build the application (skip type checking for now)
RUN npm run build:no-type-check

# Set environment variables
ENV PORT=5000
ENV NEXT_PUBLIC_API_BASE_URL=http://miningcore:4000

# Expose the port the app runs on
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
