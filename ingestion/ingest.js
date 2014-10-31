var utils = require('./utils');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var async = require('async');
// Config Variables
var LIBRARY_USAGE_MINIMUM = 20;
var MONGO_URL = 'mongodb://localhost:27017/libscore';

// REPLACE THESE VARIABLES
var rankCounter = 0;


var ingest = function (dumpFilePath, db) {

  var crawlTime = new Date().getTime();

  // The dump data is unfortunately not well formed json, so we have to convert it first
  utils.dumpToArray(dumpFilePath, function (crawlData){


    // Used to keep aggregate totals of library usage
    var libraryUsage = {};

    var sitesCollection = db.collection('sites');


    //console.log('Finished', crawlData.length);
    async.eachLimit(crawlData, 20, function(site, callback){
      rankCounter++;
      var siteSnapshot = {
        crawlTime: crawlTime,
        url: site.url,
        rank: site.rank,
        total: site.data.libs.desktop.length,
        libraries: site.data.libs.desktop // Add more here
      };
      sitesCollection.insert(siteSnapshot, function(err, result) {
        console.log('Logged site');
        callback();
      
      });

    }, function(err){

      // SITE DATA INSERT COMPLETE - SPLIT THIS INTO SEPARATE FUNCTIONS

      // 2) Calculate aggregate library usage

      _.each(crawlData, function(site){
        _.each(site.data.libs.desktop, function (lib) {
          if(typeof libraryUsage[lib] === 'undefined') {
            libraryUsage[lib] = 1;
          } else {
            libraryUsage[lib] += 1;
          }
        });
      });

      // Turn it into an array for easier sorting
      var libraryUsageArray = _.map(libraryUsage, function(value, key) {
        var lib = {library: key, count:value, crawlTime: crawlTime};
        return lib;
      });

      // Only include libraries that meet the threshold usages
      libraryUsageArray = _.filter(libraryUsageArray, function(lib) {
        return lib.count > LIBRARY_USAGE_MINIMUM ? true : false;
      });

      // Insert into Mongo
      var usageCollection = db.collection('usage');

      usageCollection.insert(libraryUsageArray, function(err, result) {
        console.log("Inserted 3 documents into the document collection", result.length);
        //callback(result);
      });
      //console.log(libraryUsageArray);


      // Log the crawl
      var crawlsCollection = db.collection('crawls');

      crawlsCollection.insert({crawlTime: crawlTime, status: 'success'}, function(err, result) {
        console.log("Crawl Logged");
      });



    });

    


  });


};


MongoClient.connect(MONGO_URL, function(err, db) {
  console.log("Connected correctly to server");

  // Start the ingestion process
  ingest('dump.json', db);

});