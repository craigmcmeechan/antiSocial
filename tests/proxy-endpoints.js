var app = require('../server/server');

var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');
var uuid = require('uuid');
var async = require('async');

describe('proxy endpoints', function () {
	this.timeout(50000);

	var client1 = request.agent();
	var client2 = request.agent();
	var clientAnon = request.agent();

	var email1 = 'mrhodes+test+proxy1@myantisocial.net';
	var email2 = 'mrhodes+test+proxy2@myantisocial.net';
	var endpoint1 = 'http://127.0.0.1:3000/user-1';
	var endpoint2 = 'http://127.0.0.1:3000/user-2';
	var password = 'testing123';
	var post1;
	var post2;

	before(function (done) {
		app.start();
		done();
	});

	it('http should be up', function (done) {
		client1
			.get('http://127.0.0.1:3000')
			.end(function (err, res) {
				expect(err).to.be(null);
				assert.equal(res.status, 200);
				done();
			});
	});

	var needSetup = true;

	if (needSetup) {

		it('should be able to create account 1', function (done) {
			client1.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email1,
					'password': password,
					'username': 'user-1'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					app.models.MyUser.findOne({
						'where': {
							'email': email1
						}
					}, function (err, user) {
						theUser = user;
					});
					done();
				});
		});

		it('should be able to update user1', function (done) {
			client1.patch('http://127.0.0.1:3000/api/MyUsers/me').send({
				username: 'user-1',
				name: 'User One'
			}).end(function (err, res) {
				expect(res.status).to.be(200);
				done();
			});
		});

		it('should be able to create account 2', function (done) {
			client2.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email2,
					'password': password,
					'username': 'user-2'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					done();
				});
		});

		it('should be able to update user2', function (done) {
			client2.patch('http://127.0.0.1:3000/api/MyUsers/me').send({
				username: 'user-2',
				name: 'User Two'
			}).end(function (err, res) {
				expect(res.status).to.be(200);
				done();
			});
		});

		it('user1 should be able to friend user2', function (done) {
			client1.get('http://127.0.0.1:3000/friend?endpoint=' + endpoint2).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user2 should be able to accept friend request from user1', function (done) {
			client2.get('http://127.0.0.1:3000/accept-friend?endpoint=' + encodeURIComponent(endpoint1)).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});
	}

	it('user2 should be able to post (public)', function (done) {
		client2.post('http://127.0.0.1:3000/post').send({
			body: 'Hello world',
			visibility: ['public', 'friends']
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body.status).to.be('ok');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			console.log(res.body);
			post1 = res.body.uuid;
			done();
		});
	});

	it('user2 should be able to post (friends only)', function (done) {
		client2.post('http://127.0.0.1:3000/post').send({
			body: 'Hello world',
			visibility: ['friends']
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			console.log(res.body);
			post2 = res.body.uuid;
			done();
		});
	});

	it('user1 should be able to to get user2 profile (json)', function (done) {
		client2.get('http://127.0.0.1:3000/proxy-profile?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/profile')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to to get user2 profile (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-profile?endpoint=' + encodeURIComponent(endpoint2 + '/profile')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('hello world from User Two')
			done();
		});
	});

	it('user1 should be able to to get user2 posts (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-posts?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(2);
			done();
		});
	});

	it('user1 should be able to to get user2 posts (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-posts?endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('anon user should be able to to get user2 public posts (json)', function (done) {
		clientAnon.get('http://127.0.0.1:3000/proxy-posts?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to to get user2 post (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-posts?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post1)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.post).to.be.an('object');
			expect(res.body.post.uuid).to.equal(post1);
			done();
		});
	});

	it('user1 should be able to to get user2 post (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post1)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

});

function getCookie(headers, id) {
	for (var i = 0; i < headers.length; i++) {
		var kv = headers[i].split(';')[0].split('=');
		if (kv[0] === id) {
			return kv[1];
		}
	}
	return null;
}
