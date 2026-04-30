const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const config = require("../config");

// lyrics.ovh: GET /v1/{artist}/{title}
async function fetchLyricsOvh(artist, title) {
  const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  console.log("[lyrics] Trying:", url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics || null;
  } catch {
    return null;
  }
}

// Genius search — metadata only (title, url, thumbnail)
async function searchGenius(query) {
  const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
  try {
    const res = await fetch(
      `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: `Bearer ${config.geniusAccessToken}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.hits?.[0]?.result || null;
  } catch {
    return null;
  }
}

function cleanString(str) {
  return str
    .replace(/\s+(official|topic|lyrics|video|audio|hd|hq|mv)\s*$/gi, "")
    .replace(/\((?:official|lyrics|video|audio|hd|hq)[^)]*\)/gi, "")
    .replace(/\[(?:official|lyrics|video|audio|hd|hq)[^\]]*\]/gi, "")
    .replace(/\s+\bft\.\s*.+$/i, "")
    .replace(/\s+\bfeat\.\s*.+$/i, "")
    .replace(/\s*-\s*Topic\s*$/i, "")
    .replace(/\s*Official\s*$/i, "")
    .trim();
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

    let rawTitle = "", rawAuthor = "";
    const manualQuery = interaction.options.getString("song");

    if (manualQuery) {
      const parts = manualQuery.split(/\s*-\s*/);
      if (parts.length >= 2) {
        rawAuthor = parts[0].trim();
        rawTitle = parts.slice(1).join(" - ").trim();
      } else {
        rawTitle = manualQuery;
      }
    } else {
      const player = bot.manager?.players?.get(interaction.guild.id);
      const track = player?.current;
      if (!track) return interaction.editReply({
        embeds: [new EmbedBuilder().setColor("Red").setDescription("❌ No song playing and no query provided.")],
      });
      rawTitle = track.title || "";
      rawAuthor = track.author || "";
    }

    // Clean artist name
    const artist = cleanString(rawAuthor);

    // Clean title — also strip "Artist - " prefix if Lavalink included it
    let songTitle = cleanString(rawTitle);
    if (artist && songTitle.toLowerCase().startsWith(artist.toLowerCase())) {
      songTitle = songTitle.slice(artist.length).replace(/^\s*[-–—]\s*/, "").trim();
    }

    const displayQuery = artist ? `${songTitle} — ${artist}` : songTitle;

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(`🔍 Searching lyrics for **${displayQuery}**...`)],
    });

    // Try Lavalink lyrics plugin first (only for currently playing, no manual query)
    if (!manualQuery) {
      try {
        const player = bot.manager?.players?.get(interaction.guild.id);
        const node = player?.node;
        const sessionId = node?.sessionId;
        if (sessionId) {
          const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
          const baseUrl = `http${config.lavalink.secure ? "s" : ""}://${config.lavalink.host}:${config.lavalink.port}`;
          const res = await fetch(`${baseUrl}/v4/sessions/${sessionId}/players/${interaction.guild.id}/track/lyrics`, {
            headers: { Authorization: config.lavalink.password },
          });
          if (res.ok) {
            const ll = await res.json();
            const lyricsText = ll.lines?.length
              ? ll.lines.map((l) => l.line).filter(Boolean).join("\n")
              : ll.text;
            if (lyricsText) {
              const chunks = lyricsText.match(/[\s\S]{1,4000}/g) || [];
              const embed = new EmbedBuilder().setColor(config.embedColor)
                .setTitle(displayQuery)
                .setDescription(chunks[0])
                .setFooter({ text: `Lyrics via ${ll.provider || ll.sourceName || "Lavalink"}` });
              await interaction.editReply({ embeds: [embed] });
              for (let i = 1; i < chunks.length; i++)
                await interaction.followUp({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])] });
              return;
            }
          }
        }
      } catch (err) {
        console.error("[lyrics] Lavalink error:", err.message);
      }
    }

    // Fallback: lyrics.ovh
    let lyrics = null;
    if (artist && songTitle) lyrics = await fetchLyricsOvh(artist, songTitle);
    if (!lyrics && songTitle) lyrics = await fetchLyricsOvh(artist || rawAuthor, songTitle);
    if (!lyrics && rawTitle) lyrics = await fetchLyricsOvh(rawAuthor, rawTitle);

    if (!lyrics) return interaction.editReply({
      embeds: [new EmbedBuilder().setColor("Red").setDescription(`❌ No lyrics found for **${displayQuery}**`)],
    });

    // Genius for metadata (thumbnail, url) — no scraping
    const geniusHit = await searchGenius(`${songTitle} ${artist}`);

    const chunks = lyrics.match(/[\s\S]{1,4000}/g) || [];
    const embed = new EmbedBuilder().setColor(config.embedColor)
      .setTitle(geniusHit?.full_title || displayQuery)
      .setDescription(chunks[0])
      .setFooter({ text: "Lyrics via lyrics.ovh" });
    if (geniusHit?.url) embed.setURL(geniusHit.url);
    if (geniusHit?.song_art_image_thumbnail_url) embed.setThumbnail(geniusHit.song_art_image_thumbnail_url);

    await interaction.editReply({ embeds: [embed] });
    for (let i = 1; i < chunks.length; i++)
      await interaction.followUp({ embeds: [new EmbedBuilder().setColor(config.embedColor).setDescription(chunks[i])] });
  },
};
