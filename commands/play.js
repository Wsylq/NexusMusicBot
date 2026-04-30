const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Song = require("../structs/Song");
const config = require("../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube, Spotify or SoundCloud")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song name, YouTube URL, or Spotify/SoundCloud link").setRequired(true)
    ),

  async execute(interaction, bot) {
    await interaction.deferReply();

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ You need to be in a voice channel.")],
      });
    }

    const query = interaction.options.getString("query");

    // Resolve Spotify/SoundCloud to search queries
    let resolved;
    try {
      resolved = await Song.resolve(query, interaction.user, bot.scdl);
    } catch (err) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ ${err.message}`)],
      });
    }

    const isPlaylist = Array.isArray(resolved);
    const queries = isPlaylist ? resolved : [resolved];

    // Get or create player
    let player = bot.manager.players.get(interaction.guild.id);
    if (!player) {
      // Use persisted volume for this guild if available
      const savedVolume = bot.guildVolumes?.get(interaction.guild.id) ?? config.defaultVolume;
      player = bot.manager.players.create({
        guildId: interaction.guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: interaction.channel.id,
        volume: savedVolume,
        autoPlay: false,
        autoLeave: true,
      });
    }

    if (!player.connected) await player.connect();

    // Search and queue all tracks
    let addedCount = 0;
    let firstTrack = null;

    for (const item of queries) {
      const res = await bot.manager.search({
        query: item.searchQuery,
        source: "youtube",
        requester: interaction.user.id,
      }).catch(() => null);

      if (!res?.tracks?.length) continue;

      const track = res.tracks[0];
      player.queue.add(track);
      addedCount++;
      if (!firstTrack) firstTrack = track;
    }

    if (!firstTrack) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No results found for **${query}**`)],
      });
    }

    if (!player.playing) player.play();

    if (isPlaylist) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`✅ Added **${addedCount}** songs to the queue.`)],
      });
    }

    const wasFirst = player.queue.size <= 1 && addedCount === 1;
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: wasFirst ? "▶️ Now Playing" : "➕ Added to Queue" })
      .setTitle(firstTrack.title)
      .setURL(firstTrack.uri)
      .addFields(
        { name: "Duration", value: firstTrack.isStream ? "LIVE" : _fmt(firstTrack.duration), inline: true },
        { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true }
      );
    if (firstTrack.artworkUrl) embed.setThumbnail(firstTrack.artworkUrl);
    if (!wasFirst) embed.addFields({ name: "Position", value: `${player.queue.size}`, inline: true });

    return interaction.editReply({ embeds: [embed] });
  },
};

function _fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
