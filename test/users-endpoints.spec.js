const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Users endpoints', function() {
  this.timeout(5000);
  let db;
  const {testUsers, testBooks, testProgress, testRatings} = helpers.makeFixtures();
  
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL
    });
    app.set('db', db);
  });

  after('Disconnect from db', () => db.destroy());

  before('Cleanup', () => helpers.cleanTables(db));

  afterEach('Cleanup', () => helpers.cleanTables(db));

  describe('GET /api/users/:user_id, get list of user books', () => {
    context('given no xss attack', () => {
      beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
      it('returns empty array if no books', () => {
        const testUser = testUsers[1];
        return supertest(app)
          .get(`/api/users/${testUser.id}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200, []);
      });  
      it('gets list of user associated books', () => {
        const testUser = testUsers[0];
        const expectedBooks = helpers.makeExpectedProgressJoin();
        return supertest(app)
          .get(`/api/users/${testUser.id}/`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200, expectedBooks);
      });  
    });
    context('given an xss attack entry', () => {
      const {maliciousBook} = helpers.makeMaliciousBook();
      const tempBooks = [...testBooks];
      const tempProgress = [...testProgress];
      const tempRatings = [...testRatings];
      tempBooks.push(maliciousBook);
      tempProgress.push({
        id: 5,
        book_id: 999,
        user_id: 1,
        percent: 5,
        reading_status: 'in progress',
        pagecount: 999,
        maxpagecount: 999
      });
      tempRatings.push(    {
        id: 5,
        content: 'css',
        user_id: 1,
        book_id: 999,
        rating: 5
      });
      const expectedBooks = helpers.makeExpectedProgressJoin();
      expectedBooks.push(
        {title:
          'Naughty naughty very naughty <script>alert("xss");</script>',
        description:
          'Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.',
        status: 'in progress',
        percent: 1,
        rating: 5,
        plot: 0,
        prose: 0,
        characters: 0,
        worldbuilding: 0,
        theme: 0,
        content: 'css',
        progress_id: 5,
        book_id: 999,
        pagecount: 999,
        maxpagecount: 999,
        reading_status: 'in progress' 
        }
      );
      const testUser = testUsers[0];
      beforeEach('insert', () => helpers.seedTables(db, testUsers, tempBooks, tempProgress, tempRatings));
      it('removes xss attack content', () => {
        return supertest(app)
          .get(`/api/users/${testUser.id}/`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200, expectedBooks);
      });  
    });
    context('given no such user', () => {
      const testUser = testUsers[0];
      beforeEach('insert', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
      it('returns 404 user does not exist', () => {
        return supertest(app)
          .get('/api/users/999/')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(404, {error: 'User does not exist'});
      });
    });
  });

  describe('POST /api/users/:user_id/, add book', () => {
    beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('creates a book, responds 201 and the new book', () => {
      const testUser = testUsers[0];
      const newBook = {
        title: 'Words of Radiance',
        description: 'Book 2 of the Stormlight Archives',
        author: 'Brandon Sanderson',
        pagecount: 0,
        maxpagecount: 1000
      };
      return supertest(app)
        .post(`/api/users/${testUser.id}/`)
        .set('Authorization', helpers.makeAuthHeader(testUser))
        .send(newBook)
        .expect(201)
        .expect(res => {
          expect(res.body).to.have.property('id');
          expect(res.body).to.have.property('book_id');
          expect(res.body).to.have.property('progress_id');
          expect(res.body).to.have.property('rating_id');
          expect(res.body.title).to.eql(newBook.title);
          expect(res.body.description).to.eql(newBook.description);
          expect(res.body.author).to.eql(newBook.author);
          expect(res.body.maxpagecount).to.eql(newBook.maxpagecount);
          expect(res.headers.location).to.eql(`/api/users/${testUser.id}/books/${res.body.book_id}`);
          expect(res.body.user_id).to.eql(testUser.id);
          expect(res.body.percent).to.eql('0');
          expect(res.body.reading_status).to.eql('in progress');
        })
        .expect(res => 
          db.from('books')
            .select('*')
            .where({id: res.body.book_id})
            .first()
            .then(row => {
              expect(row.title).to.eql(newBook.title);
              expect(row.description).to.eql(newBook.description);
              expect(row.author).to.eql(newBook.author);
            })
        )
        .expect(res => 
          db.from('progress')
            .select('*')
            .where({id: res.body.progress_id})
            .first()
            .then(row => {
              expect(row.book_id).to.eql(res.body.book_id);
              expect(row.user_id).to.eql(testUser.id);
              expect(row.percent).to.eql(0);
              expect(row.maxpagecount).to.eql(res.body.maxpagecount);
              expect(row.reading_status).to.eql('in progress');
            })
        );
    });

    const requiredFields = ['title', 'author', 'description'];
    requiredFields.forEach(field => {
      const testUser = testUsers[0];
      const newBook = {
        title: 'Words of Radiance',
        description: 'Book 2 of the Stormlight Archives',
        author: 'Brandon Sanderson'
      };
      it(`Responds with 400 and an error message when the ${field} is missing`, () => {
        delete newBook[field];
        return supertest(app)
          .post(`/api/users/${testUser.id}/`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(newBook)
          .expect(400, {error: `Missing ${field} in request body`});
      });
    });
  });

  describe('GET /api/users/:user_id/books/:book_id', () => {
    context('given no xss attack', () => {
      beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
      it('gets single book based on id from user list', () => {
        const testUser = testUsers[0];
        const bookId = 1;
        const expectedBooks = helpers.makeExpectedProgressJoin();
        const expectedBook = expectedBooks.filter(book => book.book_id === bookId);
        return supertest(app)
          .get(`/api/users/${testUser.id}/books/${bookId}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200, expectedBook);
      });  
    });
    context('given xss attack', () => {
      const {maliciousBook} = helpers.makeMaliciousBook();
      const tempBooks = [...testBooks];
      const tempProgress = [...testProgress];
      const tempRatings = [...testRatings];
      tempBooks.push(maliciousBook);
      tempProgress.push({
        id: 5,
        book_id: 999,
        user_id: 1,
        percent: 5,
        reading_status: 'in progress',
        pagecount: 999,
        maxpagecount: 999
      });
      tempRatings.push(    {
        id: 5,
        content: 'css',
        user_id: 1,
        book_id: 999,
        rating: 5
      });
      const expectedBooks = helpers.makeExpectedProgressJoin();
      expectedBooks.push(
        {title:
          'Naughty naughty very naughty <script>alert("xss");</script>',
        description:
          'Bad image <img src="https://url.to.file.which/does-not.exist" onerror="alert(document.cookie);">. But not <strong>all</strong> bad.',
        status: 'in progress',
        percent: 1,
        rating: 5,
        plot: 0,
        prose: 0,
        characters: 0,
        worldbuilding: 0,
        theme: 0,
        content: 'css',
        progress_id: 5,
        book_id: 999,
        pagecount: 999,
        maxpagecount: 999,
        reading_status: 'in progress' 
        }
      );
      const expectedBook = [expectedBooks[4]];
      const testUser = testUsers[0];
      beforeEach('insert', () => helpers.seedTables(db, testUsers, tempBooks, tempProgress, tempRatings));
      it('removes xss attack content', () => {
        return supertest(app)
          .get(`/api/users/${testUser.id}/books/999`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200, expectedBook);
      });  
    });
    context('given no such user', () => {
      const testUser = testUsers[0];
      beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
      it('returns 404 user has not logged this book', () => {
        return supertest(app)
          .get('/api/users/999/books/1')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(404, {error: 'User does not exist'});
      });
    });
    context('given no such book', () => {
      const testUser = testUsers[0];
      beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
      it('returns 404 user has not logged this book', () => {
        return supertest(app)
          .get('/api/users/1/books/999')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(404, {error: 'User has not logged this book'});
      });
    });
  });

  describe('PATCH /api/users/:user_id/books/:book_id, update book', () => {
    beforeEach('insert everything', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('responds with 204 when updating rating', () => {
      let testUser = testUsers[0];
      let testBook = testBooks[0];
      let expectedBook = {
        title: testBook.title,
        description: testBook.description,
        status: 'completed',
        percent: 1,
        rating: 5,
        plot: 5,
        prose: 5,
        characters: 5,
        worldbuilding: 5,
        theme: 5,
        progress_id: 1,
        book_id: testBook.id,
        content: 'what a twist',
        pagecount: 700,
        maxpagecount: 700,
        reading_status: 'completed'
      };
      return supertest(app)
        .patch(`/api/users/${testUser.id}/books/${testBook.id}`)
        .set('Authorization', helpers.makeAuthHeader(testUser))
        .send({
          rating: 5,
          plot: 5,
          prose: 5,
          characters: 5,
          worldbuilding: 5,
          theme: 5,
          content: 'what a twist',
          pagecount: 700,
          maxpagecount: 700
        })
        .expect(204)
        .then( () => supertest(app).get(`/api/users/${testUser.id}/books/${testBook.id}`).set('Authorization', helpers.makeAuthHeader(testUser)).expect([expectedBook]));
    });
  });

  describe('POST /api/users/, add users', () => {
    this.timeout(5000);
    context('User Validation', () => {
      beforeEach('insert users', () => 
        helpers.seedUsers(db, testUsers)
      );
      const requiredFields = ['username', 'password', 'email'];
      const testUser = testUsers[0];
      requiredFields.forEach(field => {
        const registerAttemptBody = {
          username: 'test username',
          password: 'test password',
          email: 'test email'
        };

        it(`responds with 400 required error when ${field} is missing`, () => {
          delete registerAttemptBody[field];
          return supertest(app)
            .post('/api/users')
            .set('Authorization', helpers.makeAuthHeader(testUser))
            .send(registerAttemptBody)
            .expect(400, {error: `Missing ${field} in request body`});
        });
      });


      it('responds 400 \'Password must be longer than 8 characters\' when empty password', () => {
        const userShortPass = {
          username: 'test username',
          password: '12345678',
          email: 'test email',
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(userShortPass)
          .expect(400, {error: 'Password must be longer than 8 characters'});
      });

      it('responds 400 \'Password must be shorter than 72 characters\' when empty password', () => {
        const userLongPass = {
          username: 'test username',
          password: '*'.repeat(72),
          email: 'test email',
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(userLongPass)
          .expect(400, {error: 'Password must be less than 72 characters'});
      });

      it('responds 400 \'Password must not start or end with empty space\' when password starts with space', () => {
        const userSpaceFirstPass = {
          username: 'test username',
          password: ' 12345678',
          email: 'test email',
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(userSpaceFirstPass)
          .expect(400, {error: 'Password must not start or end with empty space'});
      });

      it('responds 400 \'Password must not start or end with empty space\' when password ends with space', () => {
        const userSpaceFirstPass = {
          username: 'test username',
          password: '12345678 ',
          email: 'test email',
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(userSpaceFirstPass)
          .expect(400, {error: 'Password must not start or end with empty space'});
      });

      it('responds 400 \'Password must contain 1 upper case, 1 lower case, and 1 special character\' when password fails regex', () => {
        const simplePass = {
          username: 'test username',
          password: 'simple123',
          email: 'test email',
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(simplePass)
          .expect(400, {error: 'Password must contain 1 upper case, 1 lower case, and 1 special character'});
      });

      it('responds \'Username already taken\' when username isn\'t unique', () => {
        const dupeUser = {
          username: testUser.username,
          password: 'Simple123!',
          email: 'test email'
        };
        return supertest(app)
          .post('/api/users')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(dupeUser)
          .expect(400, {error: 'Username already taken'});
      });
    });
  });
});