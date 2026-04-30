const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the volume")
    .addIntegerOption((o) =>
      o.setName("level").setDescription("Volume level (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
    ),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    }

    const level = interaction.options.getInteger("level");
    queue.setVolume(level);

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`🔊 Volume set to **${level}%**`)],
    });
  },
};
