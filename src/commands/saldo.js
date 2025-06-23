// src/commands/saldo.js (Versión Corregida)
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

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
            const connection = await pool.getConnection();

            try {
                // 1. La consulta ahora suma la columna 'saldo_isk' y la nombramos 'total_saldo'.
                const [result] = await connection.query(
                    `SELECT SUM(o.saldo_isk) AS total_saldo
                       FROM outposts o
                       JOIN pilots p ON o.pilot_id = p.id
                       WHERE p.discord_id = ?`,
                    [user.id]
                );
                
                // 2. Guardamos el resultado en una variable con un nombre más apropiado.
                const totalSaldo = parseFloat(result[0].total_saldo);

                     if (isNaN(totalSaldo)) { // Añadimos una comprobación por si el piloto no existe
                    await interaction.editReply(`El piloto **${user.username}** no tiene registros en el sistema.`);
                } else if (totalSaldo < 0) {
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo deudor** de **${Math.abs(totalSaldo).toFixed(2)} millones ISK**.`);
                } else if (totalSaldo > 0) {
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo a favor** de **${totalSaldo.toFixed(2)} millones ISK**. ✨`);
                } else {
                    await interaction.editReply(`El piloto **${user.username}** está a paz y salvo. ✅`);
                }

            } catch (error) {
                console.error('Error al consultar el saldo del piloto:', error);
                await interaction.editReply('Hubo un error al intentar consultar el saldo.');
            } finally {
                connection.release();
            }
        }
    },
};