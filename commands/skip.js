const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue?.playing) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    }

    const skipped = queue.currentSong.title;
    queue.skip();

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`⏭️ Skipped **${skipped}**`)],
    });
  },
};
