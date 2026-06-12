FROM node:22-slim

WORKDIR /app
COPY cataloger-api/package.json ./package.json
RUN npm install --omit=dev
COPY cataloger-api/src ./src

ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]
