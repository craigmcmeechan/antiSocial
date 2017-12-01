var app = require('../server/server');

var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');
var uuid = require('uuid');
var async = require('async');

describe('friends', function () {
	this.timeout(50000);

	var client1 = request.agent();
	var client2 = request.agent();

	var email1 = 'mrhodes+test1@myantisocial.net';
	var email2 = 'mrhodes+test2@myantisocial.net';
	var password = 'testing123';
	var endpoint1 = 'http://127.0.0.1:3000/user-1';
	var endpoint2 = 'http://127.0.0.1:3000/user-2';
	var endpoint3 = 'http://127.0.0.1:3000/user-999';
	var newEndPoint = 'http://127.0.0.1:3000/user-changed';
	var theUser = null;

	before(function (done) {
		app.start();
		done();
	});

	it('delete test user1', function (done) {
		app.models.MyUser.destroyAll({
			'email': email1
		},  function (err, info) {
			expect(err).to.be(null);
			console.log(info);
			done();
		});
	});

	it('delete test user2', function (done) {
		app.models.MyUser.destroyAll({
			'email': email2
		},  function (err, info) {
			expect(err).to.be(null);
			console.log(info);
			done();
		});
	});

	it('delete all access tokens', function (done) {
		app.models.AccessToken.destroyAll({},  function (err, info) {
			expect(err).to.be(null);
			console.log(info);
			done();
		});
	});

	it('delete friends', function (done) {
		app.models.Friend.destroyAll({
			'remoteEndPoint': endpoint1
		},  function (err, info) {
			console.log(info);
			expect(err).to.be(null);
			done();
		});
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

	it('should be able to create account 1', function (done) {
		client1.post('http://127.0.0.1:3000/api/MyUsers/register')
			.type('form')
			.send({
				'email': email1,
				'password': password
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
				'password': password
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

	it('user1 should not be able to friend user2 again', function (done) {
		client1.get('http://127.0.0.1:3000/friend?endpoint=' + encodeURIComponent(endpoint2)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body.status).to.equal('duplicate friend request');
			done();
		});
	});

	it('user1 should not be able to friend unknown user', function (done) {
		client1.get('http://127.0.0.1:3000/friend?endpoint=' + encodeURIComponent(endpoint3)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body.status).to.not.equal('ok');
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

	/*
		it('user1 should be able to change endpoint', function (done) {
			app.models.Friend.find({
				'where': {
					'userId': theUser.id
				}
			}, function (err, friends) {
				async.forEach(friends, function (friend, cb) {
					var payload = {
						'accessToken': friend.remoteAccessToken,
						'newEndPoint': newEndPoint
					}

					console.log(payload);

					request.post(friend.remoteEndPoint + '/friend-webhook/change-address').send(payload).end(function (err, res) {
						expect(res.status).to.be(200);
						expect(res.body.status).to.equal('ok');
						cb();
					});
				}, function (err) {
					done();
				});
			});

		});

	*/
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
