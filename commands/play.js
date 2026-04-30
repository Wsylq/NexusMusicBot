const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const MusicQueue = require("../structs/MusicQueue");
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

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms.has("Connect") || !perms.has("Speak")) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ I don't have permission to join your voice channel.")],
      });
    }

    const query = interaction.options.getString("query");

    let result;
    try {
      result = await Song.from(query, interaction.user, bot.spotify, bot.scdl);
    } catch (err) {
      console.error("[play]", err.message);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ ${err.message}`)],
      });
    }

    const songs = Array.isArray(result) ? result : [result];

    // Get or create queue
    let queue = bot.queues.get(interaction.guild.id);

    if (!queue) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeafen: true,
      });

      queue = new MusicQueue({
        textChannel: interaction.channel,
        connection,
        scdl: bot.scdl,
      });

      bot.queues.set(interaction.guild.id, queue);
    }

    const wasEmpty = queue.size === 0;
    queue.enqueueMany(songs);

    if (songs.length === 1) {
      const song = songs[0];
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: wasEmpty ? "▶️ Now Playing" : "➕ Added to Queue" })
        .setTitle(song.title)
        .setURL(song.url)
        .addFields(
          { name: "Duration", value: song.durationFormatted, inline: true },
          { name: "Requested by", value: `<@${interaction.user.id}>`, inline: true }
        );
      if (song.thumbnail) embed.setThumbnail(song.thumbnail);
      if (!wasEmpty) embed.addFields({ name: "Position", value: `${queue.size}`, inline: true });
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.embedColor)
            .setDescription(`✅ Added **${songs.length}** songs to the queue.`),
        ],
      });
    }

    if (wasEmpty) queue.play();
  },
};
