const Discord = require('discord.js');
const client = new Discord.Client();

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken)
    throw "No discord token found!";

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const foo = require('./modules/lookup.js')(client);

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

function handleMessage(msg) {
    var firstWord = msg.content.replace(/ .*/,'');
    switch (firstWord) {
        case '!foo':
            msg.delete()
                .then(msg => console.log(`testing`))
                .then(msg.channel.send('!help'))
                .catch(console.error);
            break;
        
        //case '!lookup': {
        //    lookupTerm(msg);
        //    break;
        //}

        case 'Combat ended.': {
            console.log(message.user);
        }
    }
}
