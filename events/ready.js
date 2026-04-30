module.exports = {
  name: "clientReady",
  once: true,
  execute(client, bot) {
    console.log(`[Bot] Logged in as ${client.user.tag}`);
    client.user.setActivity("Assassin is listening to his Daddy Lossai 🎵", { type: 2 });
    bot.manager.init(client.user.id);
    console.log("[Lavalink] Manager initialized");
  },
};
