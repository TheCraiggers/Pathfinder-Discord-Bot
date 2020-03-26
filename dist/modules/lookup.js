"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const pageres_1 = require("pageres");
const axios = require('axios');
const tmp_1 = require("tmp");
class lookup {
    constructor(client) {
        let lookupCommandRegex = /^! ?lookup/i;
        client.on("message", message => {
            if (lookupCommandRegex.test(message.content ?  : )) {
                lookupTerm(message);
            }
        });
        client.on("messageUpdate", (oldMessage, newMessage) => {
            if (lookupCommandRegex.test(newMessage.content ?  : )) {
                lookupTerm(newMessage);
            }
        });
        console.log("Successfully loaded lookup plugin.");
    }
}
exports.default = lookup;
function lookupTerm(message) {
    var ID = 0;
    var searchResults = [];
    const findSearchTerm = /! ?lookup ([\w ]+)\(?(\d+)?\)?/i;
    let parsedMessageContent = message.content.match(findSearchTerm);
    if (parsedMessageContent) {
        message.reply('Invalid lookup command! Usage is !lookup <search term>')
            .catch(console.error(error));
    }
    var searchTerm = parsedMessageContent[1];
    if (parsedMessageContent.length > 1)
        var disambiguousSelector = parsedMessageContent[2];
    var disambiguousMessageText = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
    var disambiguousMessageCount = 0;
    const findID = /value='(\d+)'/i;
    const findResult = new RegExp("<strong>(" +
        searchTerm +
        ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'", "mis");
    const findResultExtended = new RegExp("<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'", "mis");
    axios.post('https://pf2.easytool.es/php/search.php', { name: searchTerm })
        .then(parseEasyToolSearchResultFucnction)
        .catch(function (error) {
        console.log(error);
    });
}
const parseEasyToolSearchResultFunction = function parseEasyToolSearchResult(err, response) {
    return __awaiter(this, void 0, void 0, function* () {
        responses = response.split("<button");
        for (parsedMessageContent of responses) {
            result = findResult.exec;
            parsedMessageContent;
            ;
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
            for (parsedMessageContent of responses) {
                result = findResultExtended.exec;
                parsedMessageContent;
                ;
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
            ID = searchResults[0][3];
            getImageAndSend(message, ID);
        }
        else if (disambiguousSelector) {
            ID = searchResults[disambiguousSelector - 1][3];
            getImageAndSend(message, ID);
        }
        else {
            message
                .reply(disambiguousMessageText)
                .then(disambiguousMessageMessage => {
                const filter = msg => /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
                message.channel
                    .awaitMessages(filter, { max: 1, time: 30000, errors: ["time"] })
                    .then(msg => {
                    msg = msg.first();
                    disambiguousMessageMessage.delete().catch(console.error);
                    ID = searchResults[parseInt(msg.content) - 1][3];
                    getImageAndSend(message, ID);
                    msg.delete().catch(console.error);
                })
                    .catch(err => {
                    console.log(err);
                    disambiguousMessageMessage.delete().catch(console.error);
                    message.reply("Lookup cancelled.");
                });
            });
        }
    });
};
function getImageAndSend(message, ID) {
    if (ID < 1)
        throw `Invalid ID given. I can't lookup ${ID}`;
    let tmpdir = tmp_1.dirSync();
    console.log("Getting screenshot...");
    let pageres = new pageres_1.Pageres({
        delay: 0,
        selector: "article.result",
        filename: parsedMessageContent, ": 
    })
        .src("https://pf2.easytool.es/index.php?id=" + ID, ["1024x768"], {
        crop: true
    })
        .dest(tmpdir.name)
        .run()
        .then(function () {
        console.log("Saving to " + tmpdir.name + "/" + parsedMessageContent.png, ");, message.channel
            .send({
            files: [
                { attachment: tmpdir.name + "/" + parsedMessageContent.png, ", name: ": results.png, " }:  }
            ]
        })
            .then(msg => {
            tmp_1.setGracefulCleanup();
        })
            .catch(error => {
            console.error(error);
            tmp_1.setGracefulCleanup();
        }));
    })
        .catch(console.error);
}
