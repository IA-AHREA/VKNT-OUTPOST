// src/commands/registrar.js
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-piloto')
        .setDescription('Registra un nuevo piloto y su primer outpost.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El usuario de Discord a registrar.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('nombre_outpost')
                .setDescription('El nombre del primer outpost.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('ubicacion')
                .setDescription('La ubicación principal del piloto.')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const nombreOutpost = interaction.options.getString('nombre_outpost');
        const ubicacion = interaction.options.getString('ubicacion');
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verificar si el piloto ya existe
            let [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [user.id]);
            let pilotId;

            if (pilots.length === 0) {
                // 2a. Si no existe, crearlo
                const [result] = await connection.execute(
                    'INSERT INTO pilots (discord_id, nombre_discord, ubicacion) VALUES (?, ?, ?)',
                    [user.id, user.username, ubicacion]
                );
                pilotId = result.insertId;
            } else {
                pilotId = pilots[0].id;
            }
            
            // 3. Obtener la tarifa mensual
            const [[config]] = await connection.execute("SELECT config_value FROM config WHERE config_key = 'TARIFA_MENSUAL_OUTPOST'");
            const deudaInicial = parseFloat(config.config_value);

            // 4. Registrar el outpost con la deuda inicial
            await connection.execute(
                'INSERT INTO outposts (pilot_id, nombre_outpost, deuda_isk) VALUES (?, ?, ?)',
                [pilotId, nombreOutpost, deudaInicial]
            );

            await connection.commit();
            await interaction.reply({
                content: `✅ Piloto **${user.username}** registrado con el outpost **${nombreOutpost}**. Deuda inicial: **${deudaInicial} millones ISK**.`,
                ephemeral: true
            });
        } catch (error) {
            await connection.rollback();
            console.error(error);
            await interaction.reply({ content: 'Hubo un error al registrar el piloto.', ephemeral: true });
        } finally {
            connection.release();
        }
    },
};