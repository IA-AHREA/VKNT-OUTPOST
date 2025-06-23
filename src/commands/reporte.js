// src/commands/reporte-deudas.js (Versión Paginada)
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db/database');

const PILOTOS_POR_PAGINA = 15; // Puedes ajustar este número

async function generateReportPage(page = 0) {
    const connection = await pool.getConnection();
    try {
        // Obtenemos el total de pilotos deudores para calcular las páginas
        const [totalResult] = await connection.query(
            `SELECT COUNT(DISTINCT p.id) as total_pilotos FROM pilots p
             JOIN outposts o ON p.id = o.pilot_id WHERE o.saldo_isk < 0`
        );
        const totalPilotos = totalResult[0].total_pilotos;
        const totalPages = Math.ceil(totalPilotos / PILOTOS_POR_PAGINA);

        if (totalPilotos === 0) {
            return { content: '🎉 ¡Felicidades! No hay pilotos con saldos deudores.', embeds: [], components: [] };
        }

        // Obtenemos solo los pilotos para la página actual usando LIMIT y OFFSET
        const offset = page * PILOTOS_POR_PAGINA;
        const [saldos_agrupados] = await connection.query(
            `SELECT p.nombre_discord, SUM(o.saldo_isk) AS deuda_total, COUNT(o.id) AS numero_de_outposts
             FROM pilots p JOIN outposts o ON p.id = o.pilot_id
             GROUP BY p.id, p.nombre_discord
             HAVING SUM(o.saldo_isk) < 0
             ORDER BY deuda_total ASC
             LIMIT ? OFFSET ?`,
            [PILOTOS_POR_PAGINA, offset]
        );

        const totalCorporacion = (await connection.query('SELECT SUM(saldo_isk) as total FROM outposts WHERE saldo_isk < 0'))[0][0].total;

        let description = '';
        saldos_agrupados.forEach(piloto => {
            description += `Piloto: **${piloto.nombre_discord}** debe **${Math.abs(piloto.deuda_total).toFixed(2)}M ISK** (${piloto.numero_de_outposts} outposts).\n\n`;
        });

        const embed = new EmbedBuilder()
            .setTitle('📄 Reporte de Deudas (Resumen por Piloto)')
            .setDescription(description)
            .setColor(0xFF0000)
            .addFields({ name: 'Deuda Total de la Corporación', value: `**${Math.abs(totalCorporacion).toFixed(2)} millones ISK**` })
            .setFooter({ text: `Página ${page + 1} de ${totalPages}` });
        
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`report_page_${page - 1}`)
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`report_page_${page + 1}`)
                    .setLabel('Siguiente')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page + 1 >= totalPages)
            );

        return { embeds: [embed], components: [buttons] };

    } finally {
        connection.release();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reporte-deudas')
        .setDescription('Genera un reporte paginado de deudas.'),
    async execute(interaction) {
        await interaction.deferReply();
        const firstPage = await generateReportPage(0);
        await interaction.editReply(firstPage);
    },
    generateReportPage // Exportamos la función para usarla en index.js
};