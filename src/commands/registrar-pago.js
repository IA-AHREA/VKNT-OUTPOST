// src/commands/registrar-pago.js
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pool = require('../db/database');

// Función de ayuda para crear el menú
async function createPilotMenu(page = 0) {
    const connection = await pool.getConnection();
    const limit = 25; // Límite de Discord por menú
    const offset = page * limit;

    try {
        // Obtener pilotos con deuda
        const [pilots] = await connection.query(
            `SELECT p.id, p.nombre_discord, SUM(o.deuda_isk) as total_deuda
             FROM pilots p
             JOIN outposts o ON p.id = o.pilot_id
             WHERE o.deuda_isk > 0
             GROUP BY p.id, p.nombre_discord
             HAVING total_deuda > 0
             ORDER BY p.nombre_discord
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        if (pilots.length === 0 && page === 0) {
            return { content: 'No hay pilotos con deudas pendientes.', components: [] };
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_pilot_payment')
            .setPlaceholder('Selecciona un piloto para registrar un pago')
            .addOptions(pilots.map(p => ({
                label: p.nombre_discord,
                description: `Deuda total: ${p.total_deuda}M ISK`,
                value: p.id.toString(),
            })));

        const [totalPilots] = await connection.query('SELECT COUNT(DISTINCT pilot_id) as count FROM outposts WHERE deuda_isk > 0');
        const totalPages = Math.ceil(totalPilots[0].count / limit);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`payment_page_${page - 1}`)
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(`payment_page_${page + 1}`)
                    .setLabel('Siguiente')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages - 1)
            );

        return {
            content: `Selecciona un piloto (Página ${page + 1} de ${totalPages}):`,
            components: [new ActionRowBuilder().addComponents(selectMenu), buttons],
            ephemeral: true,
        };

    } finally {
        connection.release();
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-pago')
        .setDescription('Inicia el proceso para registrar el pago de un piloto.'),
    async execute(interaction) {
        const menu = await createPilotMenu();
        await interaction.reply(menu);
    },
    createPilotMenu // Exportamos la función para usarla en el listener de interacciones
};