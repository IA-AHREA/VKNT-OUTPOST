// scripts/migrate-from-mysql.js
//
// Migración one-time de la base de datos MySQL original (tablas pilots,
// outposts, config) hacia Postgres via Prisma. Requiere las variables
// MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE/MYSQLPORT (origen) y
// DATABASE_URL (destino, Postgres) en el .env.
//
// Uso: npm run migrate:mysql
require('dotenv').config();
const mysql = require('mysql2/promise');
const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    if (!process.env.MYSQLHOST) {
        throw new Error('Faltan variables MYSQLHOST/MYSQLUSER/MYSQLPASSWORD/MYSQLDATABASE en el .env.');
    }

    const mysqlConn = await mysql.createConnection({
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        port: process.env.MYSQLPORT ? parseInt(process.env.MYSQLPORT, 10) : 3306,
    });

    console.log('Conectado a MySQL. Leyendo datos...');

    const [pilots] = await mysqlConn.query('SELECT * FROM pilots');
    const [outposts] = await mysqlConn.query('SELECT * FROM outposts');
    let configRows = [];
    try {
        [configRows] = await mysqlConn.query('SELECT * FROM config');
    } catch (e) {
        console.warn('⚠️  No se encontró tabla `config` en MySQL, se omite.');
    }

    await mysqlConn.end();

    console.log(`Encontrados: ${pilots.length} pilotos, ${outposts.length} outposts, ${configRows.length} filas de config.`);

    await prisma.$transaction(async (tx) => {
        for (const p of pilots) {
            await tx.pilot.create({
                data: {
                    id: p.id,
                    discordId: String(p.discord_id),
                    nombreDiscord: p.nombre_discord,
                },
            });
        }

        for (const o of outposts) {
            // El bug histórico del bot mezclaba `saldo_isk` (correcta, usada por
            // la mayoría de comandos) con una columna `deuda_isk` inexistente.
            // Preferimos saldo_isk; si por alguna razón solo existe deuda_isk,
            // la interpretamos como deuda positiva -> saldo negativo.
            const saldoOrigen = o.saldo_isk !== undefined && o.saldo_isk !== null
                ? o.saldo_isk
                : (o.deuda_isk !== undefined && o.deuda_isk !== null ? -Math.abs(o.deuda_isk) : 0);
            const saldo = new Prisma.Decimal(saldoOrigen);

            await tx.outpost.create({
                data: {
                    id: o.id,
                    pilotId: o.pilot_id,
                    nombreOutpost: o.nombre_outpost,
                    ubicacion: o.ubicacion,
                    saldoIsk: saldo,
                },
            });

            await tx.movimiento.create({
                data: {
                    outpostId: o.id,
                    pilotId: o.pilot_id,
                    tipo: 'AJUSTE',
                    monto: saldo.abs(),
                    saldoPost: saldo,
                    motivo: 'Saldo inicial migrado desde MySQL',
                },
            });
        }

        for (const c of configRows) {
            await tx.config.create({
                data: { key: c.config_key, value: String(c.config_value) },
            });
        }
    });

    // Reajustar las secuencias de autoincrement de Postgres para que los
    // próximos inserts no choquen con los IDs recién migrados.
    await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('pilots', 'id'), COALESCE((SELECT MAX(id) FROM pilots), 1))`
    );
    await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('outposts', 'id'), COALESCE((SELECT MAX(id) FROM outposts), 1))`
    );

    console.log('✅ Migración completa.');
}

main()
    .catch((err) => {
        console.error('❌ Error durante la migración:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
