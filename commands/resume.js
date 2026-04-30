const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused song"),
  async execute(interaction, bot) {
    const player = bot.manager.players.get(interaction.guild.id);
    if (!player?.paused) return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is paused.")], flags: 64 });
    player.resume();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("▶️ Resumed.")] });
  },
};

