FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN mkdir -p /app/data /app/uploads
EXPOSE 5000
CMD ["npm", "start"]
