// src/commands/registrar-pago.js
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');

const PILOTOS_POR_PAGINA = 25;

// Pilotos con saldo total negativo (deudores), ordenados por nombre.
// El saldo se calcula sobre TODOS sus outposts activos (no solo los deudores),
// igual que /saldo y /reporte-deudas, para evitar el bug histórico de mezclar
// una columna "deuda_isk" que no existe con "saldo_isk".
async function getPilotosConDeuda() {
    const pilots = await prisma.pilot.findMany({
        where: { activo: true, outposts: { some: { activo: true } } },
        include: { outposts: { where: { activo: true } } },
        orderBy: { nombreDiscord: 'asc' },
    });

    return pilots
        .map(p => ({
            id: p.id,
            nombreDiscord: p.nombreDiscord,
            totalSaldo: p.outposts.reduce((sum, o) => sum.plus(o.saldoIsk), new Prisma.Decimal(0)),
        }))
        .filter(p => p.totalSaldo.lt(0));
}

async function createPilotMenu(page = 0) {
    const deudores = await getPilotosConDeuda();

    if (deudores.length === 0 && page === 0) {
        return { content: 'No hay pilotos con deudas pendientes.', components: [], ephemeral: true };
    }

    const totalPages = Math.max(1, Math.ceil(deudores.length / PILOTOS_POR_PAGINA));
    const offset = page * PILOTOS_POR_PAGINA;
    const pilotsPagina = deudores.slice(offset, offset + PILOTOS_POR_PAGINA);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_pilot_payment')
        .setPlaceholder('Selecciona un piloto para registrar un pago')
        .addOptions(pilotsPagina.map(p => ({
            label: p.nombreDiscord,
            description: `Deuda total: ${p.totalSaldo.abs().toFixed(2)}M ISK`,
            value: p.id.toString(),
        })));

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
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-pago')
        .setDescription('Registra un pago. Especifica un piloto o mira el menú interactivo.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('piloto')
                .setDescription('El piloto al que quieres registrarle un pago directamente.')
                .setRequired(false)),

    async execute(interaction) {
        const pilotoSeleccionado = interaction.options.getUser('piloto');

        if (pilotoSeleccionado) {
            const pilot = await prisma.pilot.findUnique({ where: { discordId: pilotoSeleccionado.id } });

            if (!pilot) {
                await interaction.reply({ content: 'Este piloto no está registrado en la base de datos.', ephemeral: true });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`payment_modal_${pilot.id}`)
                .setTitle(`Registrar Pago para ${pilotoSeleccionado.username}`);

            const amountInput = new TextInputBuilder()
                .setCustomId('payment_amount')
                .setLabel('Monto a abonar (en millones ISK)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 150.5')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            await interaction.showModal(modal);
        } else {
            const menu = await createPilotMenu();
            await interaction.reply(menu);
        }
    },
    createPilotMenu,
};
