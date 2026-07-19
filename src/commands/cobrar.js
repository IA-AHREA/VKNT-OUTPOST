// src/commands/cobrar.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('Aplica un cargo o débito al saldo de un piloto.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('piloto')
                .setDescription('El piloto al que se le aplicará el cargo.')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('cantidad')
                .setDescription('La cantidad a cobrar (en millones ISK). Ingresa un número positivo.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('La razón del cobro (opcional).')
                .setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('piloto');
        const cantidadACobrar = interaction.options.getNumber('cantidad');
        const motivo = interaction.options.getString('motivo') || 'Sin motivo especificado.';

        if (cantidadACobrar <= 0) {
            await interaction.reply({ content: 'La cantidad a cobrar debe ser un número positivo.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const pilot = await prisma.pilot.findUnique({ where: { discordId: user.id } });
            if (!pilot) {
                await interaction.editReply('Este piloto no está registrado en la base de datos.');
                return;
            }

            // Para simplificar, aplicamos el débito al primer outpost del piloto.
            const outpost = await prisma.outpost.findFirst({ where: { pilotId: pilot.id, activo: true } });
            if (!outpost) {
                await interaction.editReply(`El piloto ${user.username} no tiene ningún outpost para aplicarle el cargo.`);
                return;
            }

            const nuevoSaldo = outpost.saldoIsk.minus(new Prisma.Decimal(cantidadACobrar));

            await prisma.$transaction([
                prisma.outpost.update({ where: { id: outpost.id }, data: { saldoIsk: nuevoSaldo } }),
                prisma.movimiento.create({
                    data: {
                        outpostId: outpost.id,
                        pilotId: pilot.id,
                        tipo: 'CARGO',
                        monto: cantidadACobrar,
                        saldoPost: nuevoSaldo,
                        motivo,
                        ejecutadoPorDiscordId: interaction.user.id,
                    },
                }),
            ]);

            const agregado = await prisma.outpost.aggregate({
                where: { pilotId: pilot.id, activo: true },
                _sum: { saldoIsk: true },
            });
            const nuevoSaldoTotal = agregado._sum.saldoIsk ?? new Prisma.Decimal(0);

            await interaction.editReply(
                `✅ Cargo de **${cantidadACobrar.toFixed(2)} millones ISK** aplicado a **${user.username}**.\n` +
                `**Motivo:** ${motivo}\n` +
                `**Nuevo saldo total del piloto:** ${nuevoSaldoTotal.toFixed(2)}M ISK.`
            );

        } catch (error) {
            console.error('Error en /cobrar:', error);
            await interaction.editReply('Hubo un error al aplicar el cargo.');
        }
    },
};
