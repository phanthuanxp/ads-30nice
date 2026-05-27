FROM node:24-alpine

WORKDIR /app
COPY package.json package.json
COPY server.js server.js
COPY src src
COPY public public

ENV NODE_ENV=production
ENV PORT=3010

EXPOSE 3010

CMD ["node", "server.js"]
