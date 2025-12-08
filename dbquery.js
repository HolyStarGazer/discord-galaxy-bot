const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dbquery')
        .setDescription('Execute a SQL query on the database (Admin only)')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('SQL query to execute (or filename from queries/ folder)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Defer reply since queries might take time
        await interaction.deferReply({ ephemeral: true });

        const input = interaction.options.getString('query');
        let query = input;

        // Check if input is a filename
        const queriesDir = path.join(__dirname, '../../queries');
        const queryFilePath = path.join(queriesDir, `${input}.sql`);
        
        if (fs.existsSync(queryFilePath)) {
            // Read query from file
            query = fs.readFileSync(queryFilePath, 'utf-8');
        }

        try {
            const db = new Database('./data/bot.db');

            // Prevent dangerous operations (additional safety)
            const upperQuery = query.toUpperCase().trim();
            if (upperQuery.startsWith('DROP') || 
                upperQuery.startsWith('TRUNCATE') ||
                upperQuery.includes('DELETE FROM users') ||
                upperQuery.includes('DELETE FROM game_sessions')) {
                
                return interaction.editReply({
                    content: '❌ Dangerous operations (DROP, TRUNCATE, DELETE FROM main tables) are not allowed through this command for safety.',
                    ephemeral: true
                });
            }

            const stmt = db.prepare(query);

            let result;
            let embed;

            // Check if it's a SELECT query
            if (upperQuery.startsWith('SELECT')) {
                result = stmt.all();
                
                if (result.length === 0) {
                    embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('Query Results')
                        .setDescription('No results found.')
                        .setFooter({ text: `Query executed by ${interaction.user.tag}` })
                        .setTimestamp();
                } else {
                    // Format results as a table
                    const columns = Object.keys(result[0]);
                    const maxRows = 10; // Limit display to 10 rows
                    
                    let resultText = '```\n';
                    
                    // Add header
                    resultText += columns.join(' | ') + '\n';
                    resultText += columns.map(c => '-'.repeat(c.length)).join('-+-') + '\n';
                    
                    // Add rows (limited)
                    for (let i = 0; i < Math.min(result.length, maxRows); i++) {
                        const row = result[i];
                        resultText += columns.map(col => String(row[col] ?? 'NULL')).join(' | ') + '\n';
                    }
                    
                    if (result.length > maxRows) {
                        resultText += `\n... and ${result.length - maxRows} more rows\n`;
                    }
                    
                    resultText += '```';

                    embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Query Results')
                        .setDescription(resultText.length > 4000 ? 'Results too long to display. Check console.' : resultText)
                        .addFields(
                            { name: 'Rows Returned', value: `${result.length}`, inline: true },
                            { name: 'Query', value: `\`\`\`sql\n${query.substring(0, 200)}${query.length > 200 ? '...' : ''}\n\`\`\``, inline: false }
                        )
                        .setFooter({ text: `Query executed by ${interaction.user.tag}` })
                        .setTimestamp();

                    // Log full results to console
                    console.log('\n=== Database Query Results ===');
                    console.table(result);
                }
            } else {
                // INSERT, UPDATE, DELETE, etc.
                const info = stmt.run();
                
                embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Query Executed')
                    .addFields(
                        { name: 'Changes', value: `${info.changes} row(s) affected`, inline: true },
                        { name: 'Last Insert ID', value: `${info.lastInsertRowid}`, inline: true },
                        { name: 'Query', value: `\`\`\`sql\n${query.substring(0, 200)}${query.length > 200 ? '...' : ''}\n\`\`\``, inline: false }
                    )
                    .setFooter({ text: `Query executed by ${interaction.user.tag}` })
                    .setTimestamp();
            }

            db.close();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Database query error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Query Error')
                .setDescription(`\`\`\`${error.message}\`\`\``)
                .addFields(
                    { name: 'Query', value: `\`\`\`sql\n${query.substring(0, 200)}${query.length > 200 ? '...' : ''}\n\`\`\``, inline: false }
                )
                .setFooter({ text: `Query attempted by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};