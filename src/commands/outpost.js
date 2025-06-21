// src/commands/outpost.js
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

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
        // Nos aseguramos de que el subcomando sea 'find'
        if (interaction.options.getSubcommand() === 'find') {
            const user = interaction.options.getUser('piloto');
            const connection = await pool.getConnection();

            try {
                // Hacemos una consulta a la base de datos uniendo las tablas
                // para encontrar los outposts por el discord_id del piloto.
                const [outposts] = await connection.query(
                    `SELECT o.nombre_outpost, o.ubicacion 
                     FROM outposts o
                     JOIN pilots p ON o.pilot_id = p.id
                     WHERE p.discord_id = ?
                     ORDER BY o.nombre_outpost ASC`,
                    [user.id]
                );

                // CASO 1: El piloto no tiene outposts registrados.
                if (outposts.length === 0) {
                    await interaction.reply({
                        content: `El piloto **${user.username}** no tiene ningún outpost registrado.`,
                        ephemeral: true // Mensaje solo visible para quien ejecuta el comando
                    });
                    return;
                }

                // CASO 2: El piloto sí tiene outposts. Construimos la tabla.
                let response = '```\n'; // Inicio del bloque de código
                response += `Outposts de [${user.username}]\n\n`;
                
                // Encabezados de la tabla con espaciado fijo
                response += 'No.  Nombre              Sistema\n';
                response += '---- ------------------- --------\n';

                // Llenamos la tabla con los datos
                outposts.forEach((outpost, index) => {
                    const num = `${index + 1}`.padEnd(5); // No. con padding
                    const nombre = outpost.nombre_outpost.padEnd(20); // Nombre con padding
                    const sistema = outpost.ubicacion; // El sistema no necesita padding al ser el último

                    response += `${num}${nombre}${sistema}\n`;
                });

                response += '```'; // Fin del bloque de código

                await interaction.reply(response);

            } catch (error) {
                console.error('Error al buscar outposts:', error);
                await interaction.reply({
                    content: 'Hubo un error al intentar buscar los outposts.',
                    ephemeral: true
                });
            } finally {
                connection.release();
            }
        }
    },
};