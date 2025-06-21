// src/commands/reporte.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reporte-deudas')
        .setDescription('Genera un reporte de todos los pilotos con deudas pendientes.'),
    async execute(interaction) {
        await interaction.deferReply();
        const connection = await pool.getConnection();
        try {
            const [deudores] = await connection.query(
                `SELECT p.nombre_discord, SUM(o.deuda_isk) as total_deuda
                 FROM pilots p
                 JOIN outposts o ON p.id = o.pilot_id
                 WHERE o.deuda_isk > 0
                 GROUP BY p.id, p.nombre_discord
                 HAVING total_deuda > 0
                 ORDER BY total_deuda DESC`
            );

            if (deudores.length === 0) {
                await interaction.editReply('🎉 ¡Felicidades! No hay ninguna deuda pendiente en el sistema.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('📄 Reporte de Deudas')
                .setColor(0xFF0000) // Rojo
                .setTimestamp()
                .setFooter({ text: 'Generado por tu Bot' });

            let description = '';
            deudores.forEach(d => {
                description += `**Piloto:** ${d.nombre_discord}\n**Deuda:** ${parseFloat(d.total_deuda).toFixed(2)} millones ISK\n\n`;
            });
            embed.setDescription(description);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Hubo un error al generar el reporte.');
        } finally {
            connection.release();
        }
    },
};