// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

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

// Listener de interacciones para manejar comandos y componentes
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'Hubo un error al ejecutar este comando.', ephemeral: true });
    }
  }
  // Aquí manejaremos botones y menús más adelante
});

client.login(process.env.DISCORD_TOKEN);