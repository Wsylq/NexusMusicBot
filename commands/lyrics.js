const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getSong, searchSong } = require("genius-lyrics-api");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Get lyrics for a song")
    .addStringOption((o) =>
      o.setName("song").setDescription("Song name (leave empty to use currently playing)").setRequired(false)
    ),

  async execute(interaction, bot) {
    await interaction.deferReply();

    let query = interaction.options.getString("song");

    if (!query) {
      const queue = bot.queues.get(interaction.guild.id);
      if (!queue?.currentSong) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No song playing and no query provided.")],
        });
      }
      query = queue.currentSong.title;
    }

    // Split query into title + artist if possible (e.g. "Title — Artist")
    const [rawTitle, rawArtist = ""] = query.split(/\s*[—\-]\s*/);

    const options = {
      apiKey: config.geniusAccessToken,
      title: rawTitle.trim(),
      artist: rawArtist.trim(),
      optimizeQuery: true,
    };

    try {
      const song = await getSong(options);

      if (!song || !song.lyrics) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No lyrics found for **${query}**`)],
        });
      }

      // Split into 4000-char chunks to fit Discord embed limits
      const chunks = song.lyrics.match(/[\s\S]{1,4000}/g) || [];

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(song.title)
        .setURL(song.url)
        .setDescription(chunks[0]);

      if (song.albumArt) embed.setThumbnail(song.albumArt);

      await interaction.editReply({ embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])],
        });
      }
    } catch (err) {
      console.error("[lyrics]", err.message);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ Failed to fetch lyrics.")],
      });
    }
  },
};
