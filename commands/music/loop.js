const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Toggle loop mode')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Track (repeat current)', value: 'track' },
                    { name: 'Queue (repeat all)', value: 'queue' }
                )
        ),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently playing any music!',
                flags: MessageFlags.Ephemeral
            });
        }

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel to change loop mode!',
                flags: MessageFlags.Ephemeral
            });
        }

        const mode = interaction.options.getString('mode');
        const queue = queueManager.getQueue(interaction.guildId);

        switch (mode) {
            case 'off':
                queue.loop = false;
                queue.loopQueue = false;
                await interaction.reply({ content: 'Loop mode: **Off**' });
                break;
            case 'track':
                queue.loop = true;
                queue.loopQueue = false;
                await interaction.reply({ content: 'Loop mode: **Track** (repeating current track)' });
                break;
            case 'queue':
                queue.loop = false;
                queue.loopQueue = true;
                await interaction.reply({ content: 'Loop mode: **Queue** (repeating entire queue)' });
                break;
        }
    }
};
