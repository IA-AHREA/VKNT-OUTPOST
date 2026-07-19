// src/commands/outpost.js
const { SlashCommandBuilder } = require('discord.js');
const prisma = require('../db/prisma');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('outpost')
        .setDescription('Comandos relacionados con los outposts.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('find')
                .setDescription('Busca y lista todos los outposts de un piloto.')
                .addUserOption(option =>
                    option.setName('piloto')
                        .setDescription('El piloto cuyos outposts quieres buscar.')
                        .setRequired(true))),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'find') {
            const user = interaction.options.getUser('piloto');

            try {
                const outposts = await prisma.outpost.findMany({
                    where: { activo: true, pilot: { discordId: user.id } },
                    orderBy: { nombreOutpost: 'asc' },
                    select: { nombreOutpost: true, ubicacion: true },
                });

                if (outposts.length === 0) {
                    await interaction.reply({
                        content: `El piloto **${user.username}** no tiene ningún outpost registrado.`,
                        ephemeral: true,
                    });
                    return;
                }

                let response = '```\n';
                response += `Outposts de [${user.username}]\n\n`;
                response += 'No.  Nombre              Sistema\n';
                response += '---- ------------------- --------\n';

                outposts.forEach((outpost, index) => {
                    const num = `${index + 1}`.padEnd(5);
                    const nombre = outpost.nombreOutpost.padEnd(20);
                    const sistema = outpost.ubicacion;

                    response += `${num}${nombre}${sistema}\n`;
                });

                response += '```';

                await interaction.reply(response);

            } catch (error) {
                console.error('Error al buscar outposts:', error);
                await interaction.reply({
                    content: 'Hubo un error al intentar buscar los outposts.',
                    ephemeral: true,
                });
            }
        }
    },
};
