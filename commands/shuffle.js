const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player || player.queue.size < 2) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Not enough songs to shuffle.")], ephemeral: true });
    player.queue.shuffle();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("🔀 Queue shuffled.")] });
  },
};
