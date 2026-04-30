const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Client: GeniusClient } = require("genius-lyrics");
const config = require("../config");

const genius = new GeniusClient(config.geniusAccessToken);

// Fetch lyrics from Lavalink via REST
async function fetchLavalinkLyrics(bot, guildId) {
  try {
    const player = bot.manager.players.get(guildId);
    if (!player?.current) return null;

    const node = player.node;
    const sessionId = node.sessionId;
    const baseUrl = `http${config.lavalink.secure ? "s" : ""}://${config.lavalink.host}:${config.lavalink.port}`;
    const url = `${baseUrl}/v4/sessions/${sessionId}/players/${guildId}/track/lyrics`;

    const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
    const res = await fetch(url, {
      headers: { Authorization: config.lavalink.password },
    });

    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;

    return await res.json();
  } catch (err) {
    console.error("[lyrics] Lavalink fetch error:", err.message);
    return null;
  }
}

// Genius fallback
async function fetchGeniusLyrics(queries) {
  for (const query of queries) {
    try {
      const searches = await genius.songs.search(query);
      if (!searches?.length) continue;
      const song = searches[0];
      const lyrics = await song.lyrics();
      if (lyrics) return { lyrics, title: song.title, url: song.url, thumbnail: song.image };
    } catch (err) {
      console.error(`[lyrics] Genius "${query}":`, err.message);
    }
  }
  return null;
}

function buildQueries(title, author) {
  const cleanT = title
    .replace(/\s+(official|topic|lyrics|video|audio|hd|hq|mv)\s*$/gi, "")
    .replace(/\((?:official|lyrics|video|audio)[^)]*\)/gi, "")
    .replace(/\[(?:official|lyrics|video|audio)[^\]]*\]/gi, "")
    .replace(/\s+\bft\.\s*.+$/i, "")
    .replace(/\s+\bfeat\.\s*.+$/i, "")
    .trim();

  const cleanA = author
    .replace(/\s*-\s*Topic\s*$/i, "")
    .replace(/\s*Official\s*$/i, "")
    .trim();

  const queries = new Set();
  if (cleanT && cleanA) queries.add(`${cleanT} ${cleanA}`);
  if (cleanT && cleanA) queries.add(`${cleanA} ${cleanT}`);
  if (cleanT) queries.add(cleanT);
  if (title !== cleanT) queries.add(title);
  return [...queries].filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription("Get lyrics for a song")
    .addStringOption((o) =>
      o.setName("song").setDescription("Song name (leave empty to use currently playing)").setRequired(false)
    ),

  async execute(interaction, bot) {
    await interaction.deferReply();

    let title = "", author = "";
    const manualQuery = interaction.options.getString("song");

    if (manualQuery) {
      const parts = manualQuery.split(/\s*-\s*/);
      if (parts.length >= 2) {
        author = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
      } else {
        title = manualQuery;
      }
    } else {
      const player = bot.manager?.players?.get(interaction.guild.id);
      const track = player?.current;
      if (!track) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No song playing and no query provided.")],
        });
      }
      title = track.title || "";
      author = track.author || "";
    }

    const queries = buildQueries(title, author);
    const displayQuery = queries[0] || title;

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`🔍 Searching lyrics for **${displayQuery}**...`)],
    });

    // Try Lavalink lyrics plugin first (only when playing, no manual query)
    if (!manualQuery) {
      const lavalinkLyrics = await fetchLavalinkLyrics(bot, interaction.guild.id);
      if (lavalinkLyrics) {
        let lyricsText;
        if (lavalinkLyrics.lines?.length) {
          lyricsText = lavalinkLyrics.lines.map((l) => l.line).filter(Boolean).join("\n");
        } else if (lavalinkLyrics.text) {
          lyricsText = lavalinkLyrics.text;
        }

        if (lyricsText) {
          const cleanAuthor = author.replace(/\s*-\s*Topic\s*$/i, "").replace(/\s*Official\s*$/i, "").trim();
          const chunks = lyricsText.match(/[\s\S]{1,4000}/g) || [];
          const embed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle(`${title}${cleanAuthor ? ` — ${cleanAuthor}` : ""}`)
            .setDescription(chunks[0])
            .setFooter({ text: `Lyrics via ${lavalinkLyrics.provider || lavalinkLyrics.sourceName || "Lavalink"}` });

          await interaction.editReply({ embeds: [embed] });
          for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])] });
          }
          return;
        }
      }
    }

    // Fallback to Genius
    const result = await fetchGeniusLyrics(queries);
    if (!result) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No lyrics found for **${displayQuery}**`)],
      });
    }

    const chunks = result.lyrics.match(/[\s\S]{1,4000}/g) || [];
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(result.title)
      .setDescription(chunks[0])
      .setFooter({ text: "Lyrics via Genius" });

    if (result.url) embed.setURL(result.url);
    if (result.thumbnail) embed.setThumbnail(result.thumbnail);

    await interaction.editReply({ embeds: [embed] });
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])] });
    }
  },
};
