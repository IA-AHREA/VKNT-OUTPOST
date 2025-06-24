// src/commands/registrar.js (Versión Corregida con SALDO)
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
        .addStringOption(option =>
            option.setName('ubicacion')
                .setDescription('La ubicación de ESTE outpost.')
                .setRequired(true)),
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const nombreOutpost = interaction.options.getString('nombre_outpost');
        const ubicacion = interaction.options.getString('ubicacion');
        
        await interaction.deferReply({ ephemeral: true });
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            let [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [user.id]);
            let pilotId;

            if (pilots.length === 0) {
                const [result] = await connection.execute(
                    'INSERT INTO pilots (discord_id, nombre_discord) VALUES (?, ?)',
                    [user.id, user.username]
                );
                pilotId = result.insertId;
            } else {
                pilotId = pilots[0].id;
            }
            
            const [[config]] = await connection.execute("SELECT config_value FROM config WHERE config_key = 'TARIFA_MENSUAL_OUTPOST'");
            const deudaInicial = parseFloat(config.config_value);

            // =====================================================================
            // ¡AQUÍ ESTÁ LA CORRECCIÓN!
            // Usamos la columna 'saldo_isk' y guardamos la deuda como un número negativo.
            // =====================================================================
            await connection.execute(
                'INSERT INTO outposts (pilot_id, nombre_outpost, ubicacion, saldo_isk) VALUES (?, ?, ?, ?)',
                [pilotId, nombreOutpost, ubicacion, -deudaInicial] // <-- Cambio clave aquí
            );

            await connection.commit();
            await interaction.editReply({
                content: `✅ Piloto **${user.username}** registrado con el outpost **${nombreOutpost}** en **${ubicacion}**.\nSe ha asignado un saldo inicial de **-${deudaInicial.toFixed(2)}M ISK**.`,
                ephemeral: true
            });
        } catch (error) {
            await connection.rollback();
            console.error(error);
            await interaction.editReply({ content: 'Hubo un error al registrar el piloto.', ephemeral: true });
        } finally {
            connection.release();
        }
    },
};