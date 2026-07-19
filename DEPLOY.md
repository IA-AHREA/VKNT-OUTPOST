# Despliegue en Railway

## 1. Base de datos Postgres

1. En el proyecto de Railway, **New → Database → PostgreSQL**.
2. Railway crea automáticamente la variable `DATABASE_URL` en ese plugin.

## 2. Servicio del bot

1. **New → GitHub Repo** y selecciona `VKNT-OUTPOST` (rama `main` o la que despliegues).
2. Railway detecta el `Dockerfile` y lo usa para el build automáticamente.
3. En la pestaña **Variables** del servicio del bot, agrega:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `DATABASE_URL` → usa una **reference variable** apuntando al plugin de Postgres (`${{Postgres.DATABASE_URL}}`) en vez de copiar el valor a mano.
4. No se necesita exponer ningún puerto: el bot solo abre un WebSocket saliente hacia Discord.

El `Dockerfile` corre `prisma migrate deploy` antes de arrancar el bot en cada
deploy, así que las migraciones de `prisma/migrations/` se aplican solas.

## 3. Registrar los slash commands

`deploy-commands.js` solo necesita correrse cuando agregas/cambias comandos,
no en cada arranque. Desde tu máquina, con el CLI de Railway ligado al
servicio:

```bash
railway run npm run deploy-commands
```

O ejecútalo localmente apuntando al mismo `DISCORD_TOKEN`/`CLIENT_ID`/`GUILD_ID`
de producción.

## 4. Migrar los datos desde MySQL (una sola vez)

Antes de apagar la base de datos MySQL vieja:

1. Agrega temporalmente al `.env` local las variables `MYSQLHOST`,
   `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT` (las de
   Railway/proveedor anterior) junto con el `DATABASE_URL` de Postgres ya
   desplegado.
2. Corre las migraciones de Prisma contra el Postgres de producción:
   ```bash
   npx prisma migrate deploy
   ```
3. Corre la migración de datos:
   ```bash
   npm run migrate:mysql
   ```
   Esto copia `pilots`, `outposts` y `config` preservando IDs, y crea un
   `Movimiento` tipo `AJUSTE` por outpost documentando el saldo con el que
   llegó desde MySQL.
4. Verifica con `/reporte-deudas` y `/saldo` en Discord que los números
   cuadren con lo que veías antes.
5. Una vez confirmado, puedes dar de baja la base MySQL anterior.
