const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused song"),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue?.paused) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is paused.")], ephemeral: true });
    }

    queue.resume();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("▶️ Resumed.")],
    });
  },
};
