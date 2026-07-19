// src/commands/reporte.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

const PILOTOS_POR_PAGINA = 15;

async function generateReportPage(page = 0) {
    const pilots = await prisma.pilot.findMany({
        where: { activo: true, outposts: { some: { activo: true } } },
        include: { outposts: { where: { activo: true } } },
    });

    const deudores = pilots
        .map(p => ({
            nombreDiscord: p.nombreDiscord,
            deudaTotal: p.outposts.reduce((sum, o) => sum.plus(o.saldoIsk), new Prisma.Decimal(0)),
            numeroDeOutposts: p.outposts.length,
        }))
        .filter(p => p.deudaTotal.lt(0))
        .sort((a, b) => a.deudaTotal.comparedTo(b.deudaTotal));

    const totalPilotos = deudores.length;
    const totalPages = Math.max(1, Math.ceil(totalPilotos / PILOTOS_POR_PAGINA));

    if (totalPilotos === 0) {
        return { content: '🎉 ¡Felicidades! No hay pilotos con saldos deudores.', embeds: [], components: [] };
    }

    const offset = page * PILOTOS_POR_PAGINA;
    const paginaActual = deudores.slice(offset, offset + PILOTOS_POR_PAGINA);

    const totalCorporacion = deudores.reduce((sum, p) => sum.plus(p.deudaTotal), new Prisma.Decimal(0));

    let description = '';
    paginaActual.forEach(piloto => {
        description += `Piloto: **${piloto.nombreDiscord}** debe **${piloto.deudaTotal.abs().toFixed(2)}M ISK** (${piloto.numeroDeOutposts} outposts).\n\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('📄 Reporte de Deudas (Resumen por Piloto)')
        .setDescription(description)
        .setColor(0xFF0000)
        .addFields({ name: 'Deuda Total de la Corporación', value: `**${totalCorporacion.abs().toFixed(2)} millones ISK**` })
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
    generateReportPage,
};
