// src/commands/cobro.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobro-mensual')
        .setDescription('Aplica la tarifa mensual a TODOS los outposts registrados.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo admins
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await prisma.config.findUnique({ where: { key: 'TARIFA_MENSUAL_OUTPOST' } });
            const tarifa = config ? parseFloat(config.value) : 0;

            if (!tarifa) {
                await interaction.editReply('No se ha configurado la tarifa mensual. Usa `/configurar-tarifa`.');
                return;
            }

            const outposts = await prisma.outpost.findMany({ where: { activo: true } });

            const tarifaDecimal = new Prisma.Decimal(tarifa);
            const ops = [];
            for (const outpost of outposts) {
                const nuevoSaldo = outpost.saldoIsk.minus(tarifaDecimal);
                ops.push(prisma.outpost.update({ where: { id: outpost.id }, data: { saldoIsk: nuevoSaldo } }));
                ops.push(prisma.movimiento.create({
                    data: {
                        outpostId: outpost.id,
                        pilotId: outpost.pilotId,
                        tipo: 'COBRO_MENSUAL',
                        monto: tarifaDecimal,
                        saldoPost: nuevoSaldo,
                        motivo: 'Cobro mensual de outpost',
                        ejecutadoPorDiscordId: interaction.user.id,
                    },
                }));
            }

            if (ops.length > 0) {
                await prisma.$transaction(ops);
            }

            await interaction.editReply(`✅ Cobro mensual de **${tarifa} millones ISK** aplicado. El saldo de **${outposts.length}** outposts ha sido ajustado.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('Hubo un error al procesar el cobro mensual.');
        }
    },
};
