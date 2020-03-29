"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Pageres = require("pageres");
const tmp_1 = require("tmp");
const discord_js_1 = require("discord.js");
const axios = require("axios");
class lookup {
    constructor(client) {
        let lookupCommandRegex = /^! ?lookup/i;
        client.on("message", message => {
            if (lookupCommandRegex.test(message.content)) {
                if (message instanceof discord_js_1.Message) {
                    lookupTerm(message);
                }
            }
        });
        client.on("messageUpdate", (oldMessage, newMessage) => {
            if (lookupCommandRegex.test(newMessage.content)) {
                if (newMessage instanceof discord_js_1.Message) {
                    lookupTerm(newMessage);
                }
            }
        });
        console.log("Successfully loaded lookup plugin.");
    }
}
exports.default = lookup;
function lookupTerm(message) {
    var ID = 0;
    if (!message) {
        return;
    }
    const findSearchTerm = /! ?lookup ([\w ]+)/i;
    let parsedMessageContent = message.content.match(findSearchTerm);
    var searchTerm = parsedMessageContent[1];
    if (parsedMessageContent) {
        axios.post('https://pf2.easytool.es/php/search.php', { name: searchTerm })
            .then((response) => {
            parseEasyToolSearchResult(response, searchTerm, message);
        })
            .catch(function (error) {
            console.log(error);
        });
    }
    else {
        message.reply('Invalid lookup command! Usage is !lookup <search term>')
            .catch(err => (console.error(err)));
    }
}
const parseEasyToolSearchResult = async function (response, searchTerm, message) {
    let responses = response.data.split("<button");
    let searchResults = [];
    let disambiguousMessageText = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
    let disambiguousMessageCount = 0;
    const findResultExtended = new RegExp("<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'", "mis");
    const findResult = new RegExp("<strong>(" +
        searchTerm +
        ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'", "mis");
    for (const response of responses) {
        let result = findResult.exec(response);
        if (result) {
            searchResults.push(result);
            disambiguousMessageCount++;
            disambiguousMessageText =
                disambiguousMessageText +
                    "(" +
                    disambiguousMessageCount +
                    ") " +
                    result[1] +
                    " - " +
                    result[2] +
                    "\n";
        }
    }
    console.log(searchResults);
    if (!searchResults || searchResults.length == 0) {
        for (const response of responses) {
            let result = findResultExtended.exec(response);
            if (result) {
                searchResults.push(result);
                disambiguousMessageCount++;
                disambiguousMessageText =
                    disambiguousMessageText +
                        "(" +
                        disambiguousMessageCount +
                        ") " +
                        result[1] +
                        " - " +
                        result[2] +
                        "\n";
            }
        }
    }
    if (!searchResults || searchResults.length == 0) {
        message.channel.send("Sorry, couldn't find anything when searching for " + searchTerm);
        return;
    }
    if (searchResults.length == 1) {
        let ID = Number.parseInt(searchResults[0][3]);
        getImageAndSend(message, ID);
    }
    else {
        message
            .reply(disambiguousMessageText)
            .then(disambiguousMessageMessage => {
            // make sure reply is a simple number and the search "author" is the sender
            const filter = msg => /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
            message.channel
                .awaitMessages(filter, { max: 1, time: 30000, errors: ["time"] })
                .then(msg => {
                let firstMessage = msg.first();
                disambiguousMessageMessage.delete().catch(console.error);
                let ID = Number.parseInt(searchResults[parseInt(firstMessage.content) - 1][3]);
                getImageAndSend(message, ID);
                firstMessage.delete().catch(console.error);
            })
                .catch(err => {
                console.log(err);
                disambiguousMessageMessage.delete().catch(console.error);
                message.reply("Lookup cancelled.");
            });
        });
    }
};
function getImageAndSend(message, ID) {
    if (ID < 1)
        throw `Invalid ID given. I can't lookup ${ID}`;
    let tmpdir = tmp_1.dirSync();
    console.log("Getting screenshot...");
    let pageres = new Pageres({
        delay: 0,
        selector: "article.result",
        filename: 'foo'
    })
        .src("https://pf2.easytool.es/index.php?id=" + ID, ["1024x768"], {
        crop: true
    })
        .dest(tmpdir.name)
        .run()
        .then(function () {
        console.log("Saving to " + tmpdir.name + "/foo.png");
        message.channel
            .send({
            files: [
                { attachment: tmpdir.name + "/foo.png", name: "results.png" }
            ]
        })
            .then(msg => {
            tmp_1.setGracefulCleanup();
        })
            .catch(error => {
            console.error(error);
            tmp_1.setGracefulCleanup();
        });
    })
        .catch(console.error);
}
