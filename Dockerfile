FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
