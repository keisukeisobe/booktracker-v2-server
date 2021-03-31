const knex = require('knex');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Protected endpoints', function() {
  let db;

  const {testUsers, testBooks, testProgress, testRatings} = helpers.makeFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL
    });
    app.set('db', db);
  });

  after('Disconnect from db', () => db.destroy());

  before('Cleanup', () => helpers.cleanTables(db));

  afterEach('Cleanup', () => helpers.cleanTables(db));

  describe('GET /api/users/:user_id', () => {
    beforeEach('seed database', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('responds 401 "Missing bearer token" when no token', () => {
      const validUser = testUsers[0];
      const invalidSecret = 'bad-secret';
      return supertest(app)
        .get(`/api/users/${validUser.id}`)
        .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
        .expect(401, {error: 'Unauthorized request'});
    });
    it('responds 401 "Unauthorized request" when invalid sub in payload', () => {
      const invalidUser = {username: 'user-does-not-exist', id: 1};
      return supertest(app)
        .get(`/api/users/${invalidUser.id}`)
        .set('Authorization', helpers.makeAuthHeader(invalidUser))
        .expect(401, {error: 'Unauthorized request'});
    });
  });

  describe('POST /api/users/:user_id', () => {
    beforeEach('seed database', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('responds 401 "Missing bearer token" when no token', () => {
      const validUser = testUsers[0];
      const invalidSecret = 'bad-secret';
      return supertest(app)
        .post(`/api/users/${validUser.id}`)
        .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
        .expect(401, {error: 'Unauthorized request'});
    });
    it('responds 401 "Unauthorized request" when invalid sub in payload', () => {
      const invalidUser = {username: 'user-does-not-exist', id: 1};
      return supertest(app)
        .post(`/api/users/${invalidUser.id}`)
        .set('Authorization', helpers.makeAuthHeader(invalidUser))
        .expect(401, {error: 'Unauthorized request'});
    });
  });

  describe('GET /api/users/:user_id/books/:book_id', () => {
    beforeEach('seed database', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('responds 401 "Missing bearer token" when no token', () => {
      const validUser = testUsers[0];
      const invalidSecret = 'bad-secret';
      return supertest(app)
        .post(`/api/users/${validUser.id}/books/1`)
        .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
        .expect(401, {error: 'Unauthorized request'});
    });
    it('responds 401 "Unauthorized request" when invalid sub in payload', () => {
      const invalidUser = {username: 'user-does-not-exist', id: 1};
      return supertest(app)
        .post(`/api/users/${invalidUser.id}/books/1`)
        .set('Authorization', helpers.makeAuthHeader(invalidUser))
        .expect(401, {error: 'Unauthorized request'});
    });
  });

  describe('PATCH /api/users/:user_id/books/:book_id', () => {
    beforeEach('seed database', () => helpers.seedTables(db, testUsers, testBooks, testProgress, testRatings));
    it('responds 401 "Missing bearer token" when no token', () => {
      const validUser = testUsers[0];
      const invalidSecret = 'bad-secret';
      return supertest(app)
        .patch(`/api/users/${validUser.id}/books/1`)
        .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
        .expect(401, {error: 'Unauthorized request'});
    });
    it('responds 401 "Unauthorized request" when invalid sub in payload', () => {
      const invalidUser = {username: 'user-does-not-exist', id: 1};
      return supertest(app)
        .patch(`/api/users/${invalidUser.id}/books/1`)
        .set('Authorization', helpers.makeAuthHeader(invalidUser))
        .expect(401, {error: 'Unauthorized request'});
    });
  });
});