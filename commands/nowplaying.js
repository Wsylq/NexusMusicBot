const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Show the currently playing song"),

  async execute(interaction, bot) {
    const queue = bot.queues.get(interaction.guild.id);
    const song = queue?.currentSong;

    if (!song) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Nothing is playing.")], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: "▶️ Now Playing" })
      .setTitle(song.title)
      .setURL(song.url)
      .addFields(
        { name: "Duration", value: song.durationFormatted, inline: true },
        { name: "Requested by", value: `<@${song.requestedBy.id}>`, inline: true },
        { name: "Loop", value: queue.loop, inline: true }
      );

    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    return interaction.reply({ embeds: [embed] });
  },
};
