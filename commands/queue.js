const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue")
    .addIntegerOption((o) => o.setName("page").setDescription("Page number").setMinValue(1)),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    if (!queue || queue.size === 0) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ The queue is empty.")], ephemeral: true });
    }

    const perPage = 10;
    const page = (interaction.options.getInteger("page") || 1) - 1;
    const totalPages = Math.ceil(queue.songs.length / perPage);

    const songs = queue.songs
      .slice(page * perPage, page * perPage + perPage)
      .map((s, i) => `**${page * perPage + i + 1}.** [${s.title}](${s.url}) \`${s.durationFormatted}\``)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`Queue — ${queue.songs.length} song${queue.songs.length !== 1 ? "s" : ""}`)
      .setDescription(songs)
      .setFooter({ text: `Page ${page + 1}/${totalPages} • Loop: ${queue.loop}` });

    return interaction.reply({ embeds: [embed] });
  },
};
