// src/commands/cobro.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobro-mensual')
        .setDescription('Aplica la tarifa mensual a TODOS los outposts registrados.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo admins
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const connection = await pool.getConnection();
        try {
            // 1. Obtener la tarifa mensual
            const [[config]] = await connection.execute("SELECT config_value FROM config WHERE config_key = 'TARIFA_MENSUAL_OUTPOST'");
            const tarifa = parseFloat(config.config_value);

            if (!tarifa) {
                await interaction.editReply('No se ha configurado la tarifa mensual. Usa `/configurar-tarifa`.');
                return;
            }
            
            // 2. Sumar la tarifa a la deuda de cada outpost
            const [result] = await connection.execute(
                'UPDATE outposts SET deuda_isk = deuda_isk + ?',
                [tarifa]
            );

            await interaction.editReply(`✅ Cobro mensual de **${tarifa} millones ISK** aplicado a **${result.affectedRows}** outposts.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('Hubo un error al procesar el cobro mensual.');
        } finally {
            connection.release();
        }
    },
};