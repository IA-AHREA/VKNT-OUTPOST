// src/commands/saldo.js
const { SlashCommandBuilder } = require('discord.js');
const prisma = require('../db/prisma');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saldo')
        .setDescription('Comandos para consultar saldo.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('piloto')
                .setDescription('Muestra el saldo total de un piloto específico.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El piloto cuyo saldo quieres consultar.')
                        .setRequired(true))),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'piloto') {
            const user = interaction.options.getUser('usuario');

            await interaction.deferReply({ ephemeral: true });

            try {
                const pilot = await prisma.pilot.findUnique({ where: { discordId: user.id } });

                if (!pilot) {
                    await interaction.editReply(`El piloto **${user.username}** no tiene registros en el sistema.`);
                    return;
                }

                const agregado = await prisma.outpost.aggregate({
                    where: { pilotId: pilot.id, activo: true },
                    _sum: { saldoIsk: true },
                });
                const totalSaldo = agregado._sum.saldoIsk;

                if (totalSaldo === null) {
                    await interaction.editReply(`El piloto **${user.username}** no tiene registros en el sistema.`);
                } else if (totalSaldo.lt(0)) {
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo deudor** de **${totalSaldo.abs().toFixed(2)} millones ISK**.`);
                } else if (totalSaldo.gt(0)) {
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo a favor** de **${totalSaldo.toFixed(2)} millones ISK**. ✨`);
                } else {
                    await interaction.editReply(`El piloto **${user.username}** está a paz y salvo. ✅`);
                }

            } catch (error) {
                console.error('Error al consultar el saldo del piloto:', error);
                await interaction.editReply('Hubo un error al intentar consultar el saldo.');
            }
        }
    },
};
