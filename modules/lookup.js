const captureWebsite = require('capture-website');
const curl = require('curlrequest');
const tmp = require('tmp');
const makeDir = require('make-dir');
const util = require('util');
const fs = require('fs');
const writeFile = util.promisify(fs.writeFile);
const path = require('path');

class lookup {
    constructor (client) {
        let lookupCommandRegex = /^! ?lookup/i;
        client.on('message', message => {
            if (lookupCommandRegex.test(message.content)) {
                lookupTerm(message);
            }   
        });
        client.on('messageUpdate', (oldMessage, newMessage) => {
            if (lookupCommandRegex.test(newMessage)) {
                lookupTerm(newMessage);
            }   
        });
        console.log('Successfully loaded lookup plugin.');
    }
}
function lookupTerm(message) {
    var ID=0;
    var searchResults = [];
    
    const findSearchTerm = /! ?lookup ([\w ]+)\(?(\d+)?\)?/i;
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

    curl.request({url: 'https://pf2.easytool.es/php/search.php', method:'POST', data:'name='+searchTerm}, async function (err,response) {
    
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

async function getImageAndSend(message, ID) {
    if (ID < 1)
        throw `Invalid ID given. I can't lookup ${ID}`;
    
    console.log("Getting screenshot...");
    
    let tmpdir = tmp.dirSync(),
        url = 'https://pf2.easytool.es/index.php?id='+ID,
        dest = tmpdir.name,
        filename = 'foo.png'
        finalOptions = {
            delay:0,
            width:1024,
            height:768,
            fullPage: false,
            element: 'article.result',
            scaleFactor: 1,
            type: 'png',
            launchOptions: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ]
            }
        };
    
    const screenshot = await captureWebsite.buffer(url, finalOptions);
    
    await makeDir(dest);
    
    const fullPath = path.join(dest, filename);
    
    await writeFile(fullPath, screenshot);
    
    console.log('Saving to ' + dest);
    message.channel.send({files: [{attachment: tmpdir.name+'/' + filename,name:'results.png'}]})
    .then(msg => {
        tmp.setGracefulCleanup();
    })
    .catch(error => {
        console.error(error);
        tmp.setGracefulCleanup();
    });
}

module.exports = (client) => { return new lookup(client) }
