const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { queueManager } = require('../../services/music/queue-manager');
const { getStatus, isConnected } = require('../../services/music/music-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current music queue')
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number')
                .setMinValue(1)
        ),

    async execute(interaction) {
        if (!isConnected(interaction.guildId)) {
            return interaction.reply({
                content: 'I\'m not currently playing any music!',
                flags: MessageFlags.Ephemeral
            });
        }

        const queue = queueManager.getQueue(interaction.guildId);
        const status = getStatus(interaction.guildId);

        if (queue.isEmpty) {
            return interaction.reply({
                content: 'The queue is empty! Use `/play` to add some music.',
                flags: MessageFlags.Ephemeral
            });
        }

        const page = interaction.options.getInteger('page') || 1;
        const perPage = 10;
        const queuePage = queue.getPage(page, perPage);

        if (queuePage.tracks.length === 0) {
            return interaction.reply({
                content: `Page ${page} doesn't exist. The queue has ${queuePage.totalPages} page(s).`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Build track list
        const trackList = queuePage.tracks.map(track => {
            const prefix = track.isCurrent ? '**>>**' : `${track.position}.`;
            const title = track.isCurrent ? `**${track.title}**` : track.title;
            return `${prefix} ${title} - ${track.artist} (${track.durationFormatted})`;
        }).join('\n');

        // Format remaining duration
        const remainingSeconds = queue.getRemainingDuration();
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        const embed = new EmbedBuilder()
            .setColor(0x00D4AA)
            .setTitle('Music Queue')
            .setDescription(trackList)
            .addFields(
                { name: 'Now Playing', value: status.nowPlaying ? `${status.nowPlaying.title} - ${status.nowPlaying.artist}` : 'Nothing', inline: false },
                { name: 'Tracks', value: `${queue.size}`, inline: true },
                { name: 'Duration', value: durationStr, inline: true },
                { name: 'Volume', value: `${queue.volume}%`, inline: true }
            )
            .setFooter({ text: `Page ${queuePage.page}/${queuePage.totalPages} | Loop: ${queue.loop ? 'Track' : queue.loopQueue ? 'Queue' : 'Off'}` });

        await interaction.reply({ embeds: [embed] });
    }
};
