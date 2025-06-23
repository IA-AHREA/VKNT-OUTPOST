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
           const [saldos] = await connection.query(
                `SELECT p.nombre_discord, o.nombre_outpost, o.ubicacion, o.saldo_isk
                FROM pilots p JOIN outposts o ON p.id = o.pilot_id
                WHERE o.saldo_isk < 0 ORDER BY p.nombre_discord, o.saldo_isk ASC`
            );  

            if (saldos.length === 0) {
                await interaction.editReply('🎉 ¡Felicidades! No hay ninguna deuda pendiente en el sistema.');
                return;
            }

            // Calculamos el total de la corporación sumando todas las deudas en la lista
            const totalPendiente  = saldo.reduce((acc, op) => acc + parseFloat(op.saldo_isk), 0);

            const embed = new EmbedBuilder()
                .setTitle('📄 Reporte de Saldos Deudores')
                .setColor(0xFF0000) // Rojo
                .setTimestamp();

            let description = '';
            let pilotoActual = '';
            deudas.forEach(d => {
                if (pilotoActual !== d.nombre_discord) {
                    pilotoActual = d.nombre_discord;
                    description += `\n**Piloto: ${pilotoActual}**\n`;
                }
                description += `— <span class="math-inline">\{d\.nombre\_outpost\} \(</span>{d.ubicacion}): **${Math.abs(d.saldo_isk).toFixed(2)}M ISK**\n`;
            });
            embed.setDescription(description);

            // AÑADIMOS EL CAMPO CON EL TOTAL GENERAL
            embed.addFields({
                name: 'Saldo Pendiente Total',
                value: `**${Math.abs(totalPendiente).toFixed(2)} millones ISK**`
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