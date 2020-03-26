import { Pageres } from "pageres";
const axios = require('axios');
import { dirSync, setGracefulCleanup } from "tmp";
import { Client, Message, PartialMessage } from "discord.js";

export default class lookup {
  constructor(client: Client) {
    let lookupCommandRegex: RegExp = /^! ?lookup/i;
    client.on("message", message => {
      if (lookupCommandRegex.test(message.content!)) {
        if (message instanceof Message){
          lookupTerm(message);
        }
      }
    });
    client.on("messageUpdate", (oldMessage: PartialMessage | Message, newMessage: PartialMessage | Message) => {
      if (lookupCommandRegex.test(newMessage.content?)) {
        if (newMessage instanceof Message){
          lookupTerm(newMessage);
        }
      }
    });
    console.log("Successfully loaded lookup plugin.");
  }
}

function lookupTerm(message:Message) {
  var ID: number = 0;
  var searchResults = [];

  if (!message) {
    return;
  }

  const findSearchTerm: RegExp = /! ?lookup ([\w ]+)\(?(\d+)?\)?/i;
  let parsedMessageContent:RegExpMatchArray|null = message.content.match(findSearchTerm);
  
  var searchTerm: string = parsedMessageContent![1];
  if (parsedMessageContent) {
    let disambiguousSelector = parsedMessageContent[2];
    let disambiguousMessageText: string = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
    let disambiguousMessageCount: number = 0;
    const findID = /value='(\d+)'/i;
    const findResult = new RegExp(
      "<strong>(" +
        searchTerm +
        ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'",
      "mis"
    );
    const findResultExtended = new RegExp(
      "<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'",
      "mis"
    );

    axios.post('https://pf2.easytool.es/php/search.php', { name: searchTerm })
    .then(parseEasyToolSearchResultFunction)
    .catch(function (error: any) {
      console.log(error);
    });
  } else {
    message.reply('Invalid lookup command! Usage is !lookup <search term>')
    .catch(err => (console.error(err)));
  }
}

const parseEasyToolSearchResultFunction = async function parseEasyToolSearchResult(err, response){
      responses = response.split("<button");
      for (parsedMessageContent of responses) {
        result = findResult.exec parsedMessageContent);
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
        for  parsedMessageContent of responses) {
          result = findResultExtended.exec parsedMessageContent);
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
        message.channel.send(
          "Sorry, couldn't find anything when searching for " + searchTerm
        );
        return;
      }
  
      if (searchResults.length == 1) {
        ID = searchResults[0][3];
        getImageAndSend(message, ID);
      } else if (disambiguousSelector) {
        ID = searchResults[disambiguousSelector - 1][3];
        getImageAndSend(message, ID);
      } else {
        message
          .reply(disambiguousMessageText)
          .then(disambiguousMessageMessage => {
            const filter = msg =>
              /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
  
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
    }


function getImageAndSend(message, ID) {
  if (ID < 1) throw `Invalid ID given. I can't lookup ${ID}`;
  let tmpdir = dirSync();
  console.log("Getting screenshot...");
  let pageres = new Pageres({
    delay: 0,
    selector: "article.result",
    filename:  parsedMessageContent"
  })
    .src("https://pf2.easytool.es/index.php?id=" + ID, ["1024x768"], {
      crop: true
    })
    .dest(tmpdir.name)
    .run()
    .then(function() {
      console.log("Saving to " + tmpdir.name + "/" +  parsedMessageContent.png");
      message.channel
        .send({
          files: [
            { attachment: tmpdir.name + "/" +  parsedMessageContent.png", name: "results.png" }
          ]
        })
        .then(msg => {
          setGracefulCleanup();
        })
        .catch(error => {
          console.error(error);
          setGracefulCleanup();
        });
    })
    .catch(console.error);
}
