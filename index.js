const Discord = require('discord.js');
const Pageres = require('pageres');
const curl = require('curlrequest');
const tmp = require('tmp');
const client = new Discord.Client();

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken)
    throw "No discord token found!";

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

//Check for inspire command
client.on('message', msg => {
  if (msg.content.charAt(0) === '!') 
    handleMessage(msg);
});

client.on('messageUpdate', (oldMessage, newMessage) => {
    console.log(newMessage);
    if (newMessage.content.charAt(0) === '!') 
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
        
        case '!lookup': {
            msg.delete()
            lookupTerm(msg);
            break;
        }
    }
}

function lookupTerm(message) {
    findSearchTerm = /!lookup (.*)/;
    findID = /value='(\d+)'/i;
    var ID=0;
    var tmpdir = tmp.dirSync();
    var searchTerm = message.content.match(findSearchTerm)[1];

    curl.request({url: 'http://pf2.easytool.es/php/search.php', method:'POST', data:'name='+searchTerm}, async function (err,response) {
        try {
            ID = response.match(findID)[1];
            console.log("Got ID of: "+ID);
        } catch (err) {
            if (err instanceof TypeError) {
                message.channel.send("Sorry, couldn't find anything when searching for "+searchTerm);
                return;
            } else {
                throw err;
            }

        }
        
        await new Pageres({delay: 0, selector:'article.result', filename:'foo'})
            .src('http://pf2.easytool.es/index.php?id='+ID, ['1024x768'], {crop: true})
            .dest(tmpdir.name)
            .run();
    
        console.log('Saving to ' + tmpdir.name+'/'+'foo.png');
        message.channel.send({files: [{attachment: tmpdir.name+'/'+'foo.png',name:'results.png'}]})
        .then(console.log)
        .catch(console.error);

        tmp.setGracefulCleanup();
    });
}
