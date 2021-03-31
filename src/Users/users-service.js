const BooksService =require( '../books/books-service');
// eslint-disable-next-line no-useless-escape
const REGEX_UPPER_LOWER_NUMBER_SPECIAL = /(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&])[\S]+/;
const xss = require('xss');
const bcrypt = require('bcryptjs');

const UsersService = {
  getAllUsers(db) {
    return db.from('users')
      .select('*');
  },
  getUserProfile(db, user_id) {
    return db.from('progress')
      .select('books.title', 'books.author', 'ratings.rating', 'ratings.content', 'ratings.plot', 'ratings.prose', 'ratings.characters', 'ratings.worldbuilding', 'ratings.theme', 'books.description', 'progress.reading_status', 'progress.percent', 'progress.pagecount', 'progress.maxpagecount', 'progress.id', 'books.id AS book_id')
      .join('books', 'progress.book_id', '=', 'books.id')
      .join('ratings', 'ratings.book_id', '=', 'books.id')
      .where('progress.user_id', user_id);
  },
  getUserProfileBook(db, user_id, book_id) {
    return db.from('progress')
      .select('books.title', 'books.author', 'ratings.rating', 'ratings.content', 'ratings.plot', 'ratings.prose', 'ratings.characters', 'ratings.worldbuilding', 'ratings.theme', 'books.description', 'progress.reading_status', 'progress.percent', 'progress.pagecount', 'progress.maxpagecount', 'progress.id', 'books.id AS book_id')
      .join('books', 'progress.book_id', '=', 'books.id')
      .join('ratings', 'ratings.book_id', '=', 'books.id')
      .where('progress.user_id', user_id)
      .andWhere('progress.book_id', book_id);
  },
  insertBook(db, newBook) {
    return db
      .insert(newBook)
      .into('books')
      .returning('*')
      .then(([book])=> book)
      .then(book=> BooksService.getBookById(db, book.id));
  },
  insertProgress(db, newProgress) {
    return db
      .insert(newProgress)
      .into('progress')
      .returning('*')
      .then(([progress]) => progress)
      .then(progress => BooksService.getProgressById(db, progress.id));
  },
  updateProgress(db, id, newProgress) {
    return db('progress').where({id}).update(newProgress);
  },
  insertRating(db, newRating) {
    return db
      .insert(newRating)
      .into('ratings')
      .returning('*')
      .then(([rating]) => rating)
      .then(rating => BooksService.getRatingById(db, rating.id));
  },
  updateRating(db, id, newRating) {
    return db('ratings').where({id}).update(newRating);
  },
  validatePassword(password) {
    if(password.length < 9) {
      return 'Password must be longer than 8 characters';
    }
    if(password.length >= 72) {
      return 'Password must be less than 72 characters';
    }
    if(password.startsWith(' ') || password.endsWith(' ')) {
      return 'Password must not start or end with empty space';
    }
    if(!REGEX_UPPER_LOWER_NUMBER_SPECIAL.test(password)){
      return 'Password must contain 1 upper case, 1 lower case, and 1 special character';
    }
    return null;
  },
  hasUserWithUserName(db, username) {
    return db('users')
      .where({username})
      .first()
      .then(user => !!user);
  },
  hashPassword(password) {
    return bcrypt.hash(password, 12);
  },
  serializeUser(user) {
    return {
      id: user.id,
      username: xss(user.username),
      date_created: new Date(user.date_created)
    };
  },
  insertUser(db, newUser) {
    return db.insert(newUser).into('users').returning('*').then(([user]) => user);
  },
};

module.exports = UsersService;