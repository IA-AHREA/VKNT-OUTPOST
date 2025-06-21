// src/commands/reporte.js (versión mejorada)
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reporte-deudas')
        .setDescription('Genera un reporte de todos los outposts con deudas pendientes y el total.'),
    async execute(interaction) {
        await interaction.deferReply();
        const connection = await pool.getConnection();
        try {
            const [deudas] = await connection.query(
                `SELECT 
                    p.nombre_discord, 
                    o.nombre_outpost,
                    o.ubicacion,
                    o.deuda_isk
                 FROM pilots p
                 JOIN outposts o ON p.id = o.pilot_id
                 WHERE o.deuda_isk > 0
                 ORDER BY p.nombre_discord, o.deuda_isk DESC`
            );

            if (deudas.length === 0) {
                await interaction.editReply('🎉 ¡Felicidades! No hay ninguna deuda pendiente en el sistema.');
                return;
            }

            // Calculamos el total de la corporación sumando todas las deudas en la lista
            const totalCorporacion = deudas.reduce((acc, outpost) => acc + parseFloat(outpost.deuda_isk), 0);

            const embed = new EmbedBuilder()
                .setTitle('📄 Reporte de Deudas por Outpost')
                .setColor(0xFF0000) // Rojo
                .setTimestamp();

            let description = '';
            let pilotoActual = '';
            deudas.forEach(d => {
                if (pilotoActual !== d.nombre_discord) {
                    pilotoActual = d.nombre_discord;
                    description += `\n**Piloto: ${pilotoActual}**\n`;
                }
                description += `— ${d.nombre_outpost} (${d.ubicacion}): **${parseFloat(d.deuda_isk).toFixed(2)}M ISK**\n`;
            });
            embed.setDescription(description);

            // AÑADIMOS EL CAMPO CON EL TOTAL GENERAL
            embed.addFields({
                name: 'Deuda Total de la Corporación',
                value: `**${totalCorporacion.toFixed(2)} millones ISK**`
            });
            
            embed.setFooter({ text: `Generado por ${interaction.client.user.username}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Hubo un error al generar el reporte.');
        } finally {
            connection.release();
        }
    },
};