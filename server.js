//! Dependencies **********************************************
// Dotenv to store passwords
// require('dotenv').config();

const express = require('express');
// const logger = require('morgan');
const mongoose = require('mongoose');

// Our scraping tools
const axios = require('axios');
const cheerio = require('cheerio');

// Require all models
const db = require('./models');

// Set the port
const PORT = process.env.PORT || 3000;

// Initialize Express
const app = express();

// Configure middleware
// Use morgan logger for logging requests
// app.use(logger('dev'));
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static('public'));

//! Connect to the Mongo DB **********************************************
// If deployed, use the deployed database. Otherwise use the local database
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/laxnews';

console.log(MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//! Routes **********************************************

// A GET route for scraping the uslaxmagazine website
app.get('/scrape', function(req, res) {
  // Clear the the Articles Collection first
  db.Article.deleteMany({})
    .then(function(dbArticleRem) {
      // View the added result in the console
      console.log(dbArticleRem);
    })
    .catch(function(err) {
      // If an error occurred, log it
      console.log(err);
    });

  // First, we grab the body of the html with axios
  axios
    .get('https://www.uslaxmagazine.com/college/men/')
    .then(function(response) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      const $ = cheerio.load(response.data);

      // Get the span with class .field-content, then go into children to get the title (h4 within the a tag) and the link (first child a tag)
      $('.field-content').each(function(i, element) {
        // Save an empty result object
        const result = {};

        // Get the title
        const newTitle = $(this)
          .children('a')
          .children('h4')
          .text();

        // If the result is empty, don't add to the result object
        if (newTitle !== '') {
          result.title = newTitle;

          // Get the link to the article
          const articleUrl = `https://www.uslaxmagazine.com${$(this)
            .children()
            .first()
            .attr('href')}`;
          result.link = articleUrl;

          // Get the byline of the article
          result.byLine = $(this)
            .children('h4')
            .children('span');

          // Create a new Article using the `result` object built from scraping
          db.Article.create(result)
            .then(function(dbArticle) {
              // View the added result in the console
              console.log(dbArticle);
            })
            .catch(function(err) {
              // If an error occurred, log it
              console.log(err);
            });
        } // End if is Not blank
      });

      // Send a message to the client
      res.send('Scrape Complete');
    });
});

// Route for getting all Articles from the db
app.get('/articles', function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post('/articles/:id', function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate(
        { _id: req.params.id },
        { note: dbNote._id },
        { new: true }
      );
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// DELETE route for deleting Notes
app.post('/note/:noteID', function(req, res) {
  console.log('NoteID', req.params.noteID);

  // todo Need to delete the reference in the article

  db.Note.deleteOne({ _id: req.params.noteID })
    .then(function(dbNote) {
      // If we were able to successfully delete the note, send it back
      res.json(dbNote);

      console.log('DB Note', dbNote);

      // db.Article.findOne({ notes: req.params.noteID }, function(err, doc) {
      //   console.log('Doc', doc);

      //   doc.update({ $set: { title: 'test' } });
      // });
      // const query = { notes: req.params.noteID };
      // db.Article.findOneAndUpdate(query, { notes: 'None' }, function(err, doc) {
      //   console.log(doc);
      // });

      // db.collection.update({...}, {$inc: {"answer.0.votes": 1}})
      //! this works, but erases, need to do by index
      const query = { notes: req.params.noteID };
      db.Article.findOneAndUpdate(
        query,
        { notes: { 'notes.0.votes': 1 } },
        function(err, doc) {
          console.log(doc);
        }
      );

      // const query = { notes: req.params.noteID };
      // db.Article.findOneAndUpdate(query, { notes: 'test' }, function(
      //   err,
      //   doc
      // ) {
      //   console.log(doc);
      // });

      // db.Article.update(
      //   { notes: req.params.noteID },
      //   { $set: { title: 'test' } },
      //   { upsert: true },
      //   function(err) {
      //     console.log('Updated');
      //   }
      // );

      // db.Article.findOne({ notes: req.params.noteID }, function(err, doc) {
      //   // Get the array of notes
      //   console.log('Doc', doc);

      //   Contact.update({phone:request.phone}, {$set: { phone: request.phone }}, {upsert: true}, function(err){...})

      //   // Remove the deleted note
      //   // doc.notes.splice(doc.notes.indexOf(req.params.noteID), 1);

      //   // const index = doc.notes.indexOf(req.params.noteID);
      //   // doc.notes.splice(index, 1);
      //   // console.log(index);
      //   // doc.notes[index] = 'test';
      //   // console.log(doc.notes[index]);

      //   // doc[0].notes.pull({ _id: req.params.noteID }); // removed
      // });
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });

  // db.RepoTag.destroy({
  //   where: {
  //     tagID: req.params.id,
  //   },
  // }).then(function(dbRepoTags) {
  //   res.json(dbRepoTags);
  // });
});

//! ***************************************

// todo Need to only add one note to the articles
// todo I don't need the notes collection unless adding multiple notes

//! Start the server **********************************************
app.listen(PORT, function() {
  console.log(`App running on port ${PORT}!`);
});
