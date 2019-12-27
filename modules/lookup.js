const Pageres = require('pageres');
const curl = require('curlrequest');
const tmp = require('tmp');

class lookup {
    constructor (client) {
        client.on('message', message => {
            if (message.content.startsWith('!lookup')) {
                lookupTerm(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (newMessage.content.startsWith('!lookup')) {
                lookupTerm(newMessage);
            }   
        });
        console.log('Successfully loaded lookup plugin.');
    }
}
function lookupTerm(message) {
    var ID=0;
    var searchResults = [];
    
    const findSearchTerm = /!lookup ([\w ]+)\(?(\d+)?\)?/i;
    var foo = message.content.match(findSearchTerm);
    console.log(foo);
    var searchTerm = foo[1];
    if (foo.length > 1)
        var disambiguousSelector = foo[2];

    var disambiguousMessageText = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
    var disambiguousMessageCount = 0;
    const findID = /value='(\d+)'/i;
    const findResult = new RegExp("<strong>(" + searchTerm + ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'","mis");
    const findResultExtended = new RegExp("<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'","mis");

    curl.request({url: 'http://pf2.easytool.es/php/search.php', method:'POST', data:'name='+searchTerm}, async function (err,response) {
    
        responses = response.split('<button'); 
        for (foo of responses) {
            result = findResult.exec(foo);
            if (result) {
                searchResults.push(result);
                disambiguousMessageCount++;
                disambiguousMessageText = disambiguousMessageText + "(" + disambiguousMessageCount + ") " + result[1] + ' - ' + result[2] + "\n";
            }
        }
        console.log(searchResults);
        if (!searchResults || searchResults.length == 0) {
            for (foo of responses) {
                result = findResultExtended.exec(foo);
                if (result) {
                    searchResults.push(result);
                    disambiguousMessageCount++;
                    disambiguousMessageText = disambiguousMessageText + "(" + disambiguousMessageCount + ") " + result[1] + ' - ' + result[2] + "\n";
                }
            }
        }   
        if (!searchResults || searchResults.length == 0) {
            message.channel.send("Sorry, couldn't find anything when searching for "+searchTerm);
            return;
        }
        
        if (searchResults.length == 1) {
            ID = searchResults[0][3];
            getImageAndSend(message,ID);
        } else if (disambiguousSelector) {
            ID = searchResults[disambiguousSelector-1][3];
            getImageAndSend(message,ID);
        }else {
            message.reply(disambiguousMessageText)
                .then(disambiguousMessageMessage => {
                    const filter = msg => /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
            
                    message.channel.awaitMessages(filter, {max: 1, time: 30000, errors: ['time'] })
                    .then(msg => {
                        msg = msg.first();
                        disambiguousMessageMessage.delete().catch(console.error);
                        ID = searchResults[parseInt(msg.content)-1][3];
                        getImageAndSend(message,ID);
                        msg.delete().catch(console.error);
                    })
                    .catch(err => {
                        console.log(err);
                        disambiguousMessageMessage.delete().catch(console.error);
                        message.reply('Lookup cancelled.');
                    });
                })
            
        }
    }); 
}

function getImageAndSend(message, ID) {
    if (ID < 1)
        throw `Invalid ID given. I can't lookup ${ID}`;
    let tmpdir = tmp.dirSync();
    console.log("Getting screenshot...");
    let pageres = new Pageres({delay: 0, selector:'article.result', filename:'foo'})
        .src('http://pf2.easytool.es/index.php?id='+ID, ['1024x768'], {crop: true})
        .dest(tmpdir.name)
        .run()
        .then(function() {
            console.log('Saving to ' + tmpdir.name+'/'+'foo.png');
            message.channel.send({files: [{attachment: tmpdir.name+'/'+'foo.png',name:'results.png'}]})
            .then(msg => {
                tmp.setGracefulCleanup();
            })
            .catch(error => {
                console.error(error);
                tmp.setGracefulCleanup();
            });
        })
        .catch(console.error);
}

module.exports = (client) => { return new lookup(client) }