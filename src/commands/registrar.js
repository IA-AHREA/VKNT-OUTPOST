// src/commands/registrar.js (o registrar-piloto.js)
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('registrar-piloto')
        .setDescription('Registra un nuevo piloto y su primer outpost con su ubicación.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El usuario de Discord a registrar.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('nombre_outpost')
                .setDescription('El nombre del primer outpost.')
                .setRequired(true))
        .addStringOption(option => // La opción sigue igual para el usuario
            option.setName('ubicacion')
                .setDescription('La ubicación de ESTE outpost.')
                .setRequired(true)), // Hice que sea requerida para el primer outpost
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const nombreOutpost = interaction.options.getString('nombre_outpost');
        const ubicacion = interaction.options.getString('ubicacion'); // Capturamos la ubicación
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Verificar si el piloto ya existe
            let [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [user.id]);
            let pilotId;

            if (pilots.length === 0) {
                // 2a. Si no existe, crearlo (NOTA: ya no insertamos la ubicación aquí)
                const [result] = await connection.execute(
                    'INSERT INTO pilots (discord_id, nombre_discord) VALUES (?, ?)',
                    [user.id, user.username]
                );
                pilotId = result.insertId;
            } else {
                pilotId = pilots[0].id;
            }
            
            // 3. Obtener la tarifa mensual
            const [[config]] = await connection.execute("SELECT config_value FROM config WHERE config_key = 'TARIFA_MENSUAL_OUTPOST'");
            const deudaInicial = parseFloat(config.config_value);

            // 4. Registrar el outpost con su ubicación y deuda inicial (AQUÍ ESTÁ EL CAMBIO)
            await connection.execute(
                'INSERT INTO outposts (pilot_id, nombre_outpost, ubicacion, deuda_isk) VALUES (?, ?, ?, ?)',
                [pilotId, nombreOutpost, ubicacion, deudaInicial] // Añadimos la variable 'ubicacion'
            );

            await connection.commit();
            await interaction.reply({
                content: `✅ Piloto **${user.username}** registrado con el outpost **${nombreOutpost}** en la ubicación **${ubicacion}**.`,
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