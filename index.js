const Discord = require('discord.js');
const client = new Discord.Client();

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken)
    throw "No discord token found!";

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    handleMessage(msg);
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    handleMessage(newMessage);
  });

client.login(discordToken);

/*-------------------------------------------------------------------------------
Above is the important discord connection and event handler stuff. 
Below is also important, but it's the custom bot commands!
--------------------------------------------------------------------------------*/

const foo = require('./modules/lookup.js')(client);
