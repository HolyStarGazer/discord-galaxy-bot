const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { isConnected, setVolume } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume')
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)
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
                content: 'You need to be in a voice channel to control volume!',
                flags: MessageFlags.Ephemeral
            });
        }

        const level = interaction.options.getInteger('level');
        const queue = queueManager.getQueue(interaction.guildId);
        const oldVolume = queue.volume;

        setVolume(interaction.guildId, level);

        const volumeBar = createVolumeBar(level);
        const emoji = level === 0 ? '🔇' : level < 30 ? '🔈' : level < 70 ? '🔉' : '🔊';

        await interaction.reply({
            content: `${emoji} Volume: ${oldVolume}% → **${level}%**\n${volumeBar}`
        });
    }
};

/**
 * Create a visual volume bar
 */
function createVolumeBar(volume) {
    const filled = Math.round(volume / 10);
    const empty = 10 - filled;
    return '`[' + '█'.repeat(filled) + '░'.repeat(empty) + ']`';
}
