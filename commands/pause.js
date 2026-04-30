const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current song"),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue?.playing) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    }
    if (queue.paused) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Already paused.")], ephemeral: true });
    }

    queue.pause();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription("⏸️ Paused.")],
    });
  },
};
