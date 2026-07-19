FROM node:20-slim

WORKDIR /app

# node:20-slim no trae OpenSSL; Prisma lo necesita para elegir el motor de
# consultas correcto en runtime (sin esto, "Prisma failed to detect the
# libssl/openssl version" y puede descargar el engine equivocado).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Prisma generate solo necesita el schema, no una conexión real; algunas
# plataformas (Railway incluida) no inyectan las variables del servicio
# durante el build, solo en runtime. El valor real de DATABASE_URL en
# producción lo sobreescribe.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

RUN npm ci

COPY . .

CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
