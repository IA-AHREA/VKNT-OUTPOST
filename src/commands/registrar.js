// src/commands/registrar.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const prisma = require('../db/prisma');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-piloto')
        .setDescription('Registra un nuevo piloto y su primer outpost con su ubicación.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('El usuario de Discord a registrar.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('nombre_outpost')
                .setDescription('El nombre del primer outpost.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ubicacion')
                .setDescription('La ubicación de ESTE outpost.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const nombreOutpost = interaction.options.getString('nombre_outpost');
        const ubicacion = interaction.options.getString('ubicacion');

        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await prisma.config.findUnique({ where: { key: 'TARIFA_MENSUAL_OUTPOST' } });
            const deudaInicial = config ? parseFloat(config.value) : 0;

            if (!deudaInicial) {
                await interaction.editReply('No se ha configurado la tarifa mensual (`TARIFA_MENSUAL_OUTPOST` en la tabla `config`).');
                return;
            }

            const nuevoSaldo = -deudaInicial;

            await prisma.$transaction(async (tx) => {
                const pilot = await tx.pilot.upsert({
                    where: { discordId: user.id },
                    update: {},
                    create: { discordId: user.id, nombreDiscord: user.username },
                });

                const outpost = await tx.outpost.create({
                    data: {
                        pilotId: pilot.id,
                        nombreOutpost,
                        ubicacion,
                        saldoIsk: nuevoSaldo,
                    },
                });

                await tx.movimiento.create({
                    data: {
                        outpostId: outpost.id,
                        pilotId: pilot.id,
                        tipo: 'REGISTRO_INICIAL',
                        monto: deudaInicial,
                        saldoPost: nuevoSaldo,
                        motivo: 'Alta de outpost',
                        ejecutadoPorDiscordId: interaction.user.id,
                    },
                });
            });

            await interaction.editReply({
                content: `✅ Piloto **${user.username}** registrado con el outpost **${nombreOutpost}** en **${ubicacion}**.\nSe ha asignado un saldo inicial de **-${deudaInicial.toFixed(2)}M ISK**.`,
                ephemeral: true,
            });
        } catch (error) {
            console.error('Error en /registrar-piloto:', error);
            await interaction.editReply({ content: 'Hubo un error al registrar el piloto.', ephemeral: true });
        }
    },
};
