var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');
var app = require('../server/server');
var uuid = require('uuid');

var email = uuid.v4() + '@mediapolis.com';
var email2 = uuid.v4() + '@mediapolis.com';
var file = 'tests/images/test-image.jpg';

var testUrlCopy = 'https://s3.amazonaws.com/tendr-mediapolis/test-image.jpg';

describe('upload', function () {
	this.timeout(10000);

	var persist = request.agent();
	var persist2 = request.agent();
	var token = null;
	var token2 = null;

	it('http should be up', function (done) {
		request
			.get('http://localhost:3000')
			.end(function (err, res) {
				assert.equal(res.status, 200);
				done();
			});
	});

	it('should be able to create account 1', function (done) {
		request
			.post('http://localhost:3000/api/MyUsers').send({
				email: email,
				password: 'testing123'
			}).end(function (err, res) {
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('should be able to create account 2', function (done) {
		request
			.post('http://localhost:3000/api/MyUsers').send({
				email: email2,
				password: 'testing123'
			}).end(function (err, res) {
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('user 1 should NOT be able to upload image to self not logged in', function (done) {
		var url = 'http://localhost:3000/api/MyUsers/me/upload/photo';
		persist
			.post(url).attach('uploadedFile', file)
			.end(function (err, res) {
				expect(res.status).to.be(400);
				done();
			});
	});

	it('should be able to login to account 1', function (done) {
		persist
			.post('http://localhost:3000/api/MyUsers/login')
			.send({
				email: email,
				password: 'testing123'
			})
			.end(function (err, res) {
				expect(res.status).to.be(200);
				token = res.body;
				done();
			});
	});

	it('should be able to login to account 2', function (done) {
		persist2
			.post('http://localhost:3000/api/MyUsers/login')
			.send({
				email: email2,
				password: 'testing123'
			})
			.end(function (err, res) {
				expect(res.status).to.be(200);
				token2 = res.body;
				done();
			});
	});

	it('should NOT be able to upload photo to non existant user', function (done) {
		var url = 'http://localhost:3000/api/MyUsers/999999999/upload/photo';
		persist
			.post(url).attach('uploadedFile', file)
			.end(function (err, res) {
				expect(res.status).to.be(401);
				done();
			});
	});

	it('user 1 should NOT be able to upload profile image to user 2', function (done) {
		var url = 'http://localhost:3000/api/MyUsers/' + token2.userId + '/upload/photo';
		persist
			.post(url).attach('uploadedFile', file)
			.end(function (err, res) {
				expect(res.status).to.be(401);
				done();
			});
	});

	it('user 1 should be able to upload image to self', function (done) {
		var url = 'http://localhost:3000/api/MyUsers/me/upload/photo';
		persist
			.post(url).attach('uploadedFile', file)
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.be(200);
				done();
			});
	});

	it('user 1 should be able to copy image url to self', function (done) {
		var url = 'http://localhost:3000/api/MyUsers/me/upload/background';
		persist
			.post(url)
			.send({
				url: testUrlCopy
			})
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.be(200);
				done();
			});
	});

	it('should be able to delete account 1', function (done) {
		persist
			.delete('http://localhost:3000/api/MyUsers/me')
			.end(function (err, res) {
				expect(res.status).to.be(200);
				done();
			});
	});

	it('should be able to delete account 2', function (done) {
		persist2
			.delete('http://localhost:3000/api/MyUsers/me')
			.end(function (err, res) {
				expect(res.status).to.be(200);
				done();
			});
	});
});
