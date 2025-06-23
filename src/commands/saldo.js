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
                const totalSaldo = result[0].total_saldo;

                // 3. ¡LA LÓGICA MÁS IMPORTANTE! Revisamos los tres posibles estados del saldo.
                if (totalSaldo === null) {
                    // Caso A: El piloto no está en la base de datos o no tiene outposts.
                    await interaction.editReply(`El piloto **${user.username}** no tiene registros en el sistema.`);
                } else if (totalSaldo < 0) {
                    // Caso B: El piloto tiene un saldo negativo (debe dinero).
                    // Usamos Math.abs() para mostrar la deuda como un número positivo.
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo deudor** de **${Math.abs(totalSaldo).toFixed(2)} millones ISK**.`);
                } else if (totalSaldo > 0) {
                    // Caso C: El piloto tiene un saldo positivo (crédito a favor).
                    await interaction.editReply(`El piloto **${user.username}** tiene un **saldo a favor** de **${totalSaldo.toFixed(2)} millones ISK**. ✨`);
                } else {
                    // Caso D: El saldo es exactamente cero.
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