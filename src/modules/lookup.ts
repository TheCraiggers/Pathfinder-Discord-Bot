const Pageres = require("pageres");
import { AxiosError, AxiosResponse } from "axios";
import { dirSync, setGracefulCleanup } from "tmp";
import { Client, Message, CollectorFilter, Collection } from "discord.js";
const axios = require("axios");

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
    client.on("messageUpdate", (oldMessage: Message, newMessage: Message) => {
      if (lookupCommandRegex.test(newMessage.content!)) {
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

  if (!message) {
    return;
  }

  const findSearchTerm: RegExp = /! ?lookup ([\w ]+)/i;
  let parsedMessageContent:RegExpMatchArray|null = message.content.match(findSearchTerm);
  
  var searchTerm: string = parsedMessageContent![1];
  if (parsedMessageContent) {
    axios.post('https://pf2.easytool.es/php/search.php', { name: searchTerm })
    .then((response: AxiosResponse<string>) => { 
      parseEasyToolSearchResult(response, searchTerm, message) 
    })
    .catch(function (error: AxiosError) {
      console.log(error);
    });
  } else {
    message.reply('Invalid lookup command! Usage is !lookup <search term>')
    .catch(err => (console.error(err)));
  }
}

const parseEasyToolSearchResult = async function(response: AxiosResponse<string>, searchTerm:string, message: Message){
      let responses:string[] = response.data.split("<button");
      let searchResults:RegExpExecArray[] = [];
      let disambiguousMessageText: string = "Found more than one possible term. Please let me know which one to look up by simply responding with the number.\n\n";
      let disambiguousMessageCount: number = 0;
      const findResultExtended: RegExp = new RegExp(
        "<strong>(.*?)</strong>.*<small>(.*?)</small>.*value='(\\d+?)'",
        "mis"
      );
      const findResult: RegExp = new RegExp(
        "<strong>(" +
          searchTerm +
          ")</strong>.*<small>(.*?)</small>.*value='(\\d+?)'",
        "mis"
      );
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
        message.channel.send(
          "Sorry, couldn't find anything when searching for " + searchTerm
        );
        return;
      }
  
      if (searchResults.length == 1) {
        let ID:number = Number.parseInt(searchResults[0][3]);
        getImageAndSend(message, ID);
      } else {
        message
          .reply(disambiguousMessageText)
          .then(disambiguousMessageMessage => {
            // make sure reply is a simple number and the search "author" is the sender
            const filter: CollectorFilter = msg => /^\d+$/.test(msg.content) && msg.author.id == message.author.id;
  
            message.channel
              .awaitMessages(filter, { max: 1, time: 30000, errors: ["time"] })
              .then(msg => {
                let firstMessage: Message = msg.first()!;
                disambiguousMessageMessage.delete().catch(console.error);
                let ID:number = Number.parseInt(searchResults[parseInt(firstMessage.content) - 1][3]);
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
    }


function getImageAndSend(message:Message, ID:number) {
  if (ID < 1) throw `Invalid ID given. I can't lookup ${ID}`;
  let tmpdir = dirSync();
  console.log("Getting screenshot...");
  let pageres = new Pageres({
    delay: 0,
    selector: "article.result",
    filename:  'foo'
  })
    .src("https://pf2.easytool.es/index.php?id=" + ID, ["1024x768"], {
      crop: true
    })
    .dest(tmpdir.name)
    .run()
    .then(function() {
      console.log("Saving to " + tmpdir.name + "/foo.png");
      message.channel
        .send({
          files: [
            { attachment: tmpdir.name + "/foo.png", name: "results.png" }
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
