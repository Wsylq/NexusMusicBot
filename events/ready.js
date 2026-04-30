module.exports = {
  name: "clientReady",
  once: true,
  execute(client, bot) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    client.user.setActivity("music 🎵", { type: 2 });
    bot.manager.init(client.user.id);
    console.log("[Lavalink] Manager initialized");
  },
};
