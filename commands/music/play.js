const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { JamendoClient } = require('../../services/music/jamendo-client');
const { queueManager } = require('../../services/music/queue-manager');
const { joinChannel, startPlaying, isConnected, getStatus } = require('../../services/music/music-player');

// Initialize Jamendo client (lazy loaded)
let jamendoClient = null;

function getJamendoClient() {
    if (!jamendoClient) {
        const clientId = process.env.JAMENDO_CLIENT_ID;
        if (!clientId) {
            throw new Error('JAMENDO_CLIENT_ID is not configured. Add it to your .env file.');
        }
        jamendoClient = new JamendoClient(clientId);
    }
    return jamendoClient;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play royalty-free music from Jamendo')
        .addStringOption(option =>
            option
                .setName('genre')
                .setDescription('Select a music genre')
                .setRequired(true)
                .addChoices(...JamendoClient.getGenreChoices())
        )
        .addIntegerOption(option =>
            option
                .setName('tracks')
                .setDescription('Number of tracks to queue (default: 5)')
                .setMinValue(1)
                .setMaxValue(20)
        )
        .addStringOption(option =>
            option
                .setName('order')
                .setDescription('How to sort tracks')
                .addChoices(
                    { name: 'Popular (This Week)', value: 'popularity_week' },
                    { name: 'Popular (This Month)', value: 'popularity_month' },
                    { name: 'Popular (All Time)', value: 'popularity_total' },
                    { name: 'Newest', value: 'releasedate' },
                    { name: 'Random', value: 'random' }
                )
        ),

    async execute(interaction) {
        const genre = interaction.options.getString('genre');
        const trackCount = interaction.options.getInteger('tracks') || 5;
        const order = interaction.options.getString('order') || 'popularity_week';

        // Check if user is in a voice channel
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel to use this command!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check bot permissions
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.reply({
                content: 'I need permissions to join and speak in your voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Defer reply since fetching tracks may take a moment
        await interaction.deferReply();

        try {
            // Fetch tracks from Jamendo
            const client = getJamendoClient();
            let tracks;

            if (order === 'random') {
                tracks = await client.getRandomTracks(genre, trackCount);
            } else {
                tracks = await client.getTracksByGenre(genre, trackCount, order);
            }

            if (tracks.length === 0) {
                return interaction.editReply({
                    content: `No tracks found for genre **${genre}**. Try a different genre!`
                });
            }

            // Join voice channel
            await joinChannel(voiceChannel, interaction.channel);

            // Add tracks to queue
            const queue = queueManager.getQueue(interaction.guildId);
            const wasEmpty = queue.isEmpty;
            queue.addMany(tracks);

            // Create response embed
            const embed = new EmbedBuilder()
                .setColor(0x00D4AA)
                .setTitle('Added to Queue')
                .setDescription(`Added **${tracks.length}** ${genre} tracks to the queue`)
                .addFields(
                    { name: 'Genre', value: genre.charAt(0).toUpperCase() + genre.slice(1), inline: true },
                    { name: 'Tracks Added', value: `${tracks.length}`, inline: true },
                    { name: 'Queue Size', value: `${queue.size}`, inline: true }
                )
                .setFooter({ text: 'Music from Jamendo (Royalty-Free)' });

            // Show first few tracks
            const trackList = tracks.slice(0, 5).map((track, i) =>
                `${i + 1}. **${track.title}** - ${track.artist} (${track.durationFormatted})`
            ).join('\n');

            if (trackList) {
                embed.addFields({ name: 'Tracks', value: trackList + (tracks.length > 5 ? `\n... and ${tracks.length - 5} more` : '') });
            }

            await interaction.editReply({ embeds: [embed] });

            // Start playing if this is a new queue
            if (wasEmpty) {
                await startPlaying(interaction.guildId);
            }

        } catch (error) {
            console.error('Play command error:', error);

            const errorMessage = error.message.includes('JAMENDO_CLIENT_ID')
                ? 'Music feature is not configured. Please add JAMENDO_CLIENT_ID to the .env file.'
                : `Failed to fetch music: ${error.message}`;

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
            }
        }
    }
};
