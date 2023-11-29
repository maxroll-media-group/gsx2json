
# Use the latest LTS version of Node.js as the base image
FROM node:lts

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY src ./src

# Build the application
RUN npm run build

# Start the application
CMD ["npm", "run", "start"]
