const BooksService =require( '../books/books-service');
const express = require('express');
const path = require('path');
const UsersService = require('./users-service.js');
const jsonParser = express.json();
const {requireAuth} = require('../middleware/jwt-auth');

const usersRouter = express.Router();

const serializeUserProfileBook = progress => ({
  title: progress.title,
  author_name: progress.name,
  description: progress.description,
  status: progress.reading_status,
  percent: progress.pagecount/progress.maxpagecount.toPrecision(3),
  rating: progress.rating,
  plot: progress.plot,
  prose: progress.prose,
  characters: progress.characters,
  worldbuilding: progress.worldbuilding,
  theme: progress.theme,
  content: progress.content,
  progress_id: progress.id,
  book_id: progress.book_id,
  pagecount: progress.pagecount,
  maxpagecount: progress.maxpagecount,
  reading_status: progress.reading_status
});

// eslint-disable-next-line no-unused-vars
usersRouter.post('/users/', jsonParser, (req, res, next) =>{
  const {username, password, email} = req.body;
  for (const field of ['username', 'password', 'email']){
    if(!req.body[field]){
      return res.status(400).json({error: `Missing ${field} in request body`});
    }
  }
  const passwordError = UsersService.validatePassword(password);
  if(passwordError) {
    return res.status(400).json({error: passwordError});
  }

  UsersService.hasUserWithUserName(
    req.app.get('db'),
    username
  )
    .then(hasUserWithUserName => {
      if(hasUserWithUserName){
        return res.status(400).json({error: 'Username already taken'});
      }
      return UsersService.hashPassword(password)
        .then(hashedPassword => {
          const newUser = {
            username,
            password: hashedPassword,
            email,
            date_created: 'now()'
          };
          return UsersService.insertUser(req.app.get('db'), newUser)
            .then(user => {
              res.status(201).location(path.posix.join(req.originalUrl, `/${user.id}`))
                .json(UsersService.serializeUser(user));
            });
        });
    });

});

usersRouter.route('/users/:user_id')
  .all(requireAuth)
  // eslint-disable-next-line no-unused-vars
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    UsersService.getUserProfile(knexInstance, req.params.user_id)
      .then(profile => {
        (knexInstance.from('users').select('id').where('id', req.params.user_id).then(result => {
          if (result.length > 0){
            res.json(profile.map(serializeUserProfileBook));
          } else {
            return res.status(404).json({error: 'User does not exist'});
          }
        }));
      });
  })
  .post(jsonParser, (req, res, next) => {
    const { title, author, description, maxpagecount } = req.body;
    const newBook =  { title, author, description };
    const requiredFields = ['title', 'author', 'description'];
    for (const key of requiredFields) {
      if(!(key in req.body)){
        return res.status(400).json({error: `Missing ${key} in request body`});
      }
    }
    if(maxpagecount === null || undefined){
      return res.status(400).json({error: 'Missing page count in request body'});
    }
    let newBookId = '';
    UsersService.insertBook(
      req.app.get('db'),
      newBook
    )
      .then(book => {
        newBookId = book.id;
        const newProgress = {
          book_id: newBookId,
          user_id: req.user.id,
          percent: 0,
          reading_status: 'in progress',
          pagecount: 0,
          maxpagecount: maxpagecount
        };
        UsersService.insertProgress(
          req.app.get('db'),
          newProgress
        )
          .then(progress => {
            progress.progress_id = progress.id;
            const newRating = {content: '', book_id: newBookId, user_id: req.user.id, rating: 0};
            UsersService.insertRating(req.app.get('db'), newRating)
              .then(rating => {
                rating.rating_id = rating.id;
                let mergedObj = {...BooksService.serializeBook(book), ...progress, ...rating};
                res.status(201).location(path.posix.join(req.originalUrl, `/books/${book.id}`))
                  .json(mergedObj);  
              });
          });
      })
      .catch(next);
  });

usersRouter.route('/users/:user_id/books/:book_id')
  .all(requireAuth)
  // eslint-disable-next-line no-unused-vars
  .get((req, res, next) => {
    const knexInstance = req.app.get('db');
    UsersService.getUserProfileBook(knexInstance, req.params.user_id, req.params.book_id)
      .then(book => {
        knexInstance.from('users').select('id').where('id', req.params.user_id).then(result => {
          if (result.length > 0){
            if(book.length === 0) {
              return res.status(404).json({error: 'User has not logged this book'});
            } else {
              res.json(book.map(serializeUserProfileBook));
            }
          } else {
            return res.status(404).json({error: 'User does not exist'});
          }
          if(book.length === 0) {
            return res.status(404).json({error: 'User has not logged this book'});
          }
        });
      });
  })
  .patch(jsonParser, (req, res, next) => {
    const { rating, plot, prose, characters, worldbuilding, theme, content, pagecount, maxpagecount, reading_status} = req.body;
    const updateRating = {rating, plot, prose, characters, worldbuilding, theme, content};
    const updateProgress = {pagecount, maxpagecount, reading_status, percent: pagecount/maxpagecount};
    if (pagecount >= maxpagecount){
      updateProgress.reading_status = 'completed';
    }
    if (reading_status === 'completed'){
      updateProgress.pagecount = maxpagecount;
    }
    for (let key in updateRating){
      if (updateRating[key]=== null || undefined) {
        return res.status(400).json({error: 'Request body must contain rating.'});
      }
    }
    const userId = req.params.user_id;
    const bookId = req.params.book_id;
    const ratingId = req.app.get('db').from('ratings').select('ratings.id').where('ratings.book_id', bookId).andWhere('ratings.user_id', userId);
    const progressId = req.app.get('db').from('progress').select('progress.id').where('progress.book_id', bookId).andWhere('progress.user_id', userId);
    UsersService.updateRating(req.app.get('db'), ratingId, updateRating)
      .then( () => {
        UsersService.updateProgress(req.app.get('db'), progressId, updateProgress)
          .then( () => {
            res.status(204).end();
          });
      })
      .catch(next);    
  });

module.exports = usersRouter;
