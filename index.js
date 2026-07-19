// index.js
// PEGA ESTE BLOQUE CORREGIDO EN SU LUGAR

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    InteractionResponseFlags
} = require('discord.js'); // Todas las importaciones de discord.js en un solo lugar

const registrarPagoCommand = require('./src/commands/registrar-pago.js');
const reporteDeudasCommand = require('./src/commands/reporte.js');
const prisma = require('./src/db/prisma.js');
const { aplicarPago } = require('./src/lib/pagos.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Cargar comandos
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[ADVERTENCIA] Al comando en ${filePath} le falta la propiedad "data" o "execute".`);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot listo! Conectado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {

    // 1. Manejador de Slash Commands (este ya lo tenías)
   if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error("Error ejecutando un comando:", error); // Log más descriptivo
            
            // Bloque catch más seguro para responder
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Hubo un error terrible al ejecutar este comando.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Hubo un error terrible al ejecutar este comando.', ephemeral: true });
                }
            } catch (replyError) {
                console.error("Error al intentar enviar mensaje de error:", replyError);
            }
        }
    }

    // 2. Manejador de Menús Desplegables
    else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_pilot_payment') {
            const pilotId = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`payment_modal_${pilotId}`) // ID dinámico para saber a quién cobrar
                .setTitle('Registrar Pago');

            const amountInput = new TextInputBuilder()
                .setCustomId('payment_amount')
                .setLabel("Monto a abonar (en millones ISK)")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 150.5')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        }
    }

    // 3. Manejador de Botones (para la paginación)
    else if (interaction.isButton()) {
    // Lógica para los botones del menú de pago
    if (interaction.customId.startsWith('payment_page_')) {
        const page = parseInt(interaction.customId.split('_')[2], 10);
        const newMenu = await registrarPagoCommand.createPilotMenu(page);
        await interaction.update(newMenu);
    }
    // NUEVA LÓGICA para los botones del reporte
    else if (interaction.customId.startsWith('report_page_')) {
        await interaction.deferUpdate(); // Confirma la interacción para que no falle
        const page = parseInt(interaction.customId.split('_')[2], 10);
        const newPage = await reporteDeudasCommand.generateReportPage(page);
        await interaction.editReply(newPage);
    }
}

    // 4. Manejador de "Modals" (la ventana emergente de pago)
    else if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('payment_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const pilotId = interaction.customId.split('_')[2];
            const amountString = interaction.fields.getTextInputValue('payment_amount');
            const amountPaid = parseFloat(amountString);

            if (isNaN(amountPaid) || amountPaid <= 0) {
                await interaction.editReply('Por favor, ingresa un número válido y positivo.');
                return;
            }

            try {
                const nuevoSaldoTotal = await aplicarPago(parseInt(pilotId, 10), amountPaid, {
                    ejecutadoPorDiscordId: interaction.user.id,
                    motivo: 'Pago vía menú interactivo',
                });

                await interaction.editReply(
                    `✅ Pago de **${amountPaid.toFixed(2)} millones ISK** registrado exitosamente.\n` +
                    `**Nuevo saldo total del piloto:** ${nuevoSaldoTotal.toFixed(2)}M ISK.`
                );
            } catch (error) {
                console.error(error);
                await interaction.editReply('Hubo un error al procesar el pago en la base de datos.');
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);