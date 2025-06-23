// src/commands/pago.js
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

            // Lógica de pago (versión "deuda"):
            let remainingAmount = amountPaid;
            const [outposts] = await connection.execute(
                'SELECT id, deuda_isk FROM outposts WHERE pilot_id = ? AND deuda_isk > 0 ORDER BY fecha_registro ASC',
                [pilotId]
            );

            if (outposts.length === 0) {
                await interaction.editReply(`El piloto ${user.username} no tiene deudas pendientes.`);
                return;
            }

            for (const outpost of outposts) {
                if (remainingAmount <= 0) break;
                const paymentForThisOutpost = Math.min(remainingAmount, outpost.deuda_isk);
                const newDebt = outpost.deuda_isk - paymentForThisOutpost;
                await connection.execute('UPDATE outposts SET deuda_isk = ? WHERE id = ?', [newDebt, outpost.id]);
                remainingAmount -= paymentForThisOutpost;
            }
            
            await interaction.editReply(`✅ Pago rápido de **${amountPaid.toFixed(2)} millones ISK** para **${user.username}** registrado exitosamente.`);

        } catch (error) {
            console.error('Error en /pago rápido:', error);
            await interaction.editReply('Hubo un error al procesar el pago.');
        } finally {
            connection.release();
        }
    },
};