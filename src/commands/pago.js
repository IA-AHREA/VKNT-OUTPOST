// src/commands/pago.js (Versión que maneja saldos a favor)
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pago')
        .setDescription('Registra un pago rápido para un piloto específico.')
        .addUserOption(option =>
            option.setName('piloto')
                .setDescription('El piloto que realiza el pago.')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('cantidad')
                .setDescription('El monto a abonar (en millones ISK). Ej: 150.5')
                .setRequired(true)),

   // Pega esto dentro de tu archivo pago.js, reemplazando la función execute

async execute(interaction) {
    const user = interaction.options.getUser('piloto');
    const amountPaid = interaction.options.getNumber('cantidad');

    if (amountPaid <= 0) {
        await interaction.reply({ content: 'La cantidad del pago debe ser un número positivo.', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });
    const connection = await pool.getConnection();

    try {
        const [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [user.id]);
        if (pilots.length === 0) {
            await interaction.editReply('Este piloto no está registrado en la base de datos.');
            return;
        }
        const pilotId = pilots[0].id;

        console.log(`\n--- INICIANDO PROCESO DE PAGO PARA ${user.username} ---`);
        console.log(`Monto del pago recibido: ${amountPaid}`);
        
        let remainingAmount = amountPaid;
        const [outposts] = await connection.execute(
            'SELECT id, saldo_isk FROM outposts WHERE pilot_id = ? AND saldo_isk < 0 ORDER BY saldo_isk ASC',
            [pilotId]
        );

        if (outposts.length > 0) {
            console.log(`Se encontraron ${outposts.length} outposts con deuda.`);
            for (const outpost of outposts) {
                console.log(`\nProcesando outpost ID ${outpost.id} con saldo: ${outpost.saldo_isk}`);
                if (remainingAmount <= 0) {
                    console.log("No queda más monto del pago. Saliendo del bucle.");
                    break;
                }
                const debtToPay = Math.abs(outpost.saldo_isk);
                const paymentForThisOutpost = Math.min(remainingAmount, debtToPay);
                const newBalance = parseFloat(outpost.saldo_isk) + paymentForThisOutpost;

                console.log(`   - Deuda del outpost: ${debtToPay}`);
                console.log(`   - Pago a aplicar a este outpost: ${paymentForThisOutpost}`);
                console.log(`   - Cálculo de nuevo saldo: ${outpost.saldo_isk} + ${paymentForThisOutpost} = ${newBalance}`);

                await connection.execute('UPDATE outposts SET saldo_isk = ? WHERE id = ?', [newBalance, outpost.id]);
                console.log(`   - DB UPDATE: Saldo del outpost ${outpost.id} actualizado a ${newBalance.toFixed(2)}`);
                
                remainingAmount -= paymentForThisOutpost;
                console.log(`   - Monto del pago restante: ${remainingAmount}`);
            }
        } else {
            console.log("No se encontraron deudas. El pago se registrará como saldo a favor.");
        }

        if (remainingAmount > 0) {
            console.log(`\nSOBRANTE DETECTADO: ${remainingAmount}`);
            const [anyOutpost] = await connection.execute('SELECT id, saldo_isk FROM outposts WHERE pilot_id = ? LIMIT 1', [pilotId]);
            if (anyOutpost.length > 0) {
                const targetOutpost = anyOutpost[0];
                console.log(`   - Aplicando sobrante al outpost ID ${targetOutpost.id} que tiene un saldo de ${targetOutpost.saldo_isk}`);
                await connection.execute('UPDATE outposts SET saldo_isk = saldo_isk + ? WHERE id = ?', [remainingAmount, targetOutpost.id]);
                console.log(`   - DB UPDATE: Saldo del outpost ${targetOutpost.id} actualizado con el sobrante.`);
            }
        }
        
        const [result] = await connection.query('SELECT SUM(saldo_isk) AS total_saldo FROM outposts WHERE pilot_id = ?', [pilotId]);
        const nuevoSaldoTotal = result[0].total_saldo;
        console.log(`--- PROCESO FINALIZADO. Nuevo saldo total en DB: ${nuevoSaldoTotal} ---\n`);

        await interaction.editReply(
            `✅ Pago de **${amountPaid.toFixed(2)}M ISK** para **${user.username}** registrado.\n` +
            `**Nuevo saldo total del piloto:** ${parseFloat(nuevoSaldoTotal).toFixed(2)}M ISK.`
        );

    } catch (error) {
        console.error('Error en /pago rápido:', error);
        await interaction.editReply('Hubo un error al procesar el pago.');
    } finally {
        connection.release();
    }
}
};