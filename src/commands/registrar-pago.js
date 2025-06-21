// src/commands/registrar-pago.js (versión inteligente)

// Importaciones necesarias para el Modal y los menús
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const pool = require('../db/database');

// La función para crear el menú se queda igual
async function createPilotMenu(page = 0) {
    const connection = await pool.getConnection();
    const limit = 25;
    const offset = page * limit;

    try {
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
            return { content: 'No hay pilotos con deudas pendientes.', components: [], ephemeral: true };
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

// El export principal del comando
module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-pago')
        .setDescription('Registra un pago. Especifica un piloto o mira el menú interactivo.')
        .addUserOption(option => // La opción de usuario ahora es OPCIONAL
            option.setName('piloto')
                .setDescription('El piloto al que quieres registrarle un pago directamente.')
                .setRequired(false)), // <-- La clave es que ya no es requerido

    async execute(interaction) {
        const pilotoSeleccionado = interaction.options.getUser('piloto');

        // CASO 1: Se especificó un piloto en el comando
        if (pilotoSeleccionado) {
            const connection = await pool.getConnection();
            try {
                const [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [pilotoSeleccionado.id]);

                if (pilots.length === 0) {
                    await interaction.reply({ content: 'Este piloto no está registrado en la base de datos.', ephemeral: true });
                    return;
                }
                const pilotId = pilots[0].id;

                // Creamos y mostramos el modal directamente
                const modal = new ModalBuilder()
                    .setCustomId(`payment_modal_${pilotId}`)
                    .setTitle(`Registrar Pago para ${pilotoSeleccionado.username}`);

                const amountInput = new TextInputBuilder()
                    .setCustomId('payment_amount')
                    .setLabel("Monto a abonar (en millones ISK)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ej: 150.5')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                await interaction.showModal(modal);

            } finally {
                connection.release();
            }
        } 
        // CASO 2: No se especificó un piloto, mostramos el menú
        else {
            const menu = await createPilotMenu();
            await interaction.reply(menu);
        }
    },
    // Exportamos la función para que el listener de paginación en index.js siga funcionando
    createPilotMenu
};