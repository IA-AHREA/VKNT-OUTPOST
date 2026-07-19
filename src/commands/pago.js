// src/commands/pago.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../db/prisma');
const { aplicarPago } = require('../lib/pagos');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pago')
        .setDescription('Registra un pago rápido para un piloto específico.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

        try {
            const pilot = await prisma.pilot.findUnique({ where: { discordId: user.id } });
            if (!pilot) {
                await interaction.editReply('Este piloto no está registrado en la base de datos.');
                return;
            }

            const nuevoSaldoTotal = await aplicarPago(pilot.id, amountPaid, {
                ejecutadoPorDiscordId: interaction.user.id,
                motivo: 'Pago rápido',
            });

            await interaction.editReply(
                `✅ Pago de **${amountPaid.toFixed(2)}M ISK** para **${user.username}** registrado.\n` +
                `**Nuevo saldo total del piloto:** ${nuevoSaldoTotal.toFixed(2)}M ISK.`
            );

        } catch (error) {
            console.error('Error en /pago rápido:', error);
            await interaction.editReply('Hubo un error al procesar el pago.');
        }
    },
};
