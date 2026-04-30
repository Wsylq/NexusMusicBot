const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder().setName("help").setDescription("Show all commands"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle("Nexus Music — Commands")
      .addFields(
        {
          name: "🎵 Playback",
          value: [
            "`/play <query>` — Play from YouTube, Spotify or SoundCloud",
            "`/pause` — Pause",
            "`/resume` — Resume",
            "`/skip` — Skip current song",
            "`/stop` — Stop and clear queue",
          ].join("\n"),
        },
        {
          name: "📋 Queue",
          value: [
            "`/queue [page]` — Show queue",
            "`/nowplaying` — Current song",
            "`/shuffle` — Shuffle queue",
            "`/loop <off|track|queue>` — Set loop mode",
            "`/volume <1-100>` — Set volume",
          ].join("\n"),
        },
        {
          name: "🎤 Other",
          value: [
            "`/lyrics [song]` — Get lyrics (uses current song if empty)",
            "`/recent` — Last 10 played songs",
            "`/autoplay` — Toggle autoplay recommendations",
            "`/help` — This message",
          ].join("\n"),
        }
      )
      .setFooter({ text: "Supports: YouTube • Spotify • SoundCloud" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
