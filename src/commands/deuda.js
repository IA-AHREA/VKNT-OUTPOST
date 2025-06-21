// src/commands/deuda.js
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deuda')
        .setDescription('Comandos para consultar deudas.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('piloto')
                .setDescription('Muestra la deuda total de un piloto específico.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El piloto cuya deuda quieres consultar.')
                        .setRequired(true))),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'piloto') {
            const user = interaction.options.getUser('usuario');
            
                    // ESPÍA #2: Ver las variables al ejecutar un comando
            console.log(`[Comando /deuda] Intentando usar la DB con el host: ${process.env.MYSQLHOST}`);


            await interaction.deferReply({ ephemeral: true }); // Efímero para no spamear el canal
            const connection = await pool.getConnection();

            try {
                // Usamos SUM() en SQL para sumar todas las deudas de los outposts
                // que pertenecen al piloto seleccionado.
                const [result] = await connection.query(
                    `SELECT SUM(o.deuda_isk) AS total_deuda
                     FROM outposts o
                     JOIN pilots p ON o.pilot_id = p.id
                     WHERE p.discord_id = ?`,
                    [user.id]
                );
                
                const totalDeuda = result[0].total_deuda;

                if (totalDeuda === null || totalDeuda <= 0) {
                    await interaction.editReply(`El piloto **${user.username}** no tiene deudas pendientes. ¡Felicidades! 🎉`);
                } else {
                    await interaction.editReply(`El piloto **${user.username}** tiene una deuda total de **${parseFloat(totalDeuda).toFixed(2)} millones ISK**.`);
                }

            } catch (error) {
                console.error('Error al consultar la deuda del piloto:', error);
                await interaction.editReply('Hubo un error al intentar consultar la deuda.');
            } finally {
                connection.release();
            }
        }
    },
};