// src/commands/cobrar.js
const { SlashCommandBuilder } = require('discord.js');
const pool = require('../db/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('Aplica un cargo o débito al saldo de un piloto.')
        .addUserOption(option =>
            option.setName('piloto')
                .setDescription('El piloto al que se le aplicará el cargo.')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('cantidad')
                .setDescription('La cantidad a cobrar (en millones ISK). Ingresa un número positivo.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('La razón del cobro (opcional).')
                .setRequired(false)),

    async execute(interaction) {
        const user = interaction.options.getUser('piloto');
        const cantidadACobrar = interaction.options.getNumber('cantidad');
        const motivo = interaction.options.getString('motivo') || 'Sin motivo especificado.';

        if (cantidadACobrar <= 0) {
            await interaction.reply({ content: 'La cantidad a cobrar debe ser un número positivo.', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });
        const connection = await pool.getConnection();

        try {
            const [pilots] = await connection.execute('SELECT id FROM pilots WHERE discord_id = ?', [user.id]);
            if (pilots.length === 0) {
                await interaction.editReply('Este piloto no está registrado en la base de datos.');
                return;
            }
            const pilotId = pilots[0].id;

            // Para simplificar, aplicaremos el débito al primer outpost del piloto.
            // Una lógica más avanzada podría distribuirlo, pero esto es funcional y claro.
            const [outposts] = await connection.execute('SELECT id FROM outposts WHERE pilot_id = ? LIMIT 1', [pilotId]);
            if (outposts.length === 0) {
                await interaction.editReply(`El piloto ${user.username} no tiene ningún outpost para aplicarle el cargo.`);
                return;
            }
            const outpostId = outposts[0].id;

            // La lógica clave: RESTAMOS la cantidad del saldo actual.
            await connection.execute(
                'UPDATE outposts SET saldo_isk = saldo_isk - ? WHERE id = ?',
                [cantidadACobrar, outpostId]
            );
            
            // Consultamos el nuevo saldo total para informarlo
            const [result] = await connection.query(
                'SELECT SUM(saldo_isk) AS total_saldo FROM outposts WHERE pilot_id = ?',
                [pilotId]
            );
            const nuevoSaldoTotal = result[0].total_saldo;

            await interaction.editReply(
                `✅ Cargo de **${cantidadACobrar.toFixed(2)} millones ISK** aplicado a **${user.username}**.\n` +
                `**Motivo:** ${motivo}\n` +
                `**Nuevo saldo total del piloto:** ${parseFloat(nuevoSaldoTotal).toFixed(2)}M ISK.`
            );

        } catch (error) {
            console.error('Error en /cobrar:', error);
            await interaction.editReply('Hubo un error al aplicar el cargo.');
        } finally {
            connection.release();
        }
    },
};