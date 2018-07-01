var app = require('../server/server');

var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');
var uuid = require('uuid');
var async = require('async');

describe('communities', function () {
	this.timeout(50000);

	before(function (done) {
		app.start();
		done();
	});

	var client1 = request.agent();
	var email1 = 'mrhodes+test1@myantisocial.net';
	var endpoint1 = 'http://127.0.0.1:3000/';
	var password = 'testing123';

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
				'password': password,
				'name': 'user-1'
			})
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.equal(200);
				var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
				expect(accessToken).to.be.a('string');
				endpoint1 += res.body.result.username;
				done();
			});
	});

	it('should be able to create a community', function (done) {
		client1.post('http://127.0.0.1:3000/api/Communities')
			.type('form')
			.send({
				'name': 'community one',
				'nickname': 'community-one',
				'viewPolicy': 'open',
				'postPolicy': 'open'
			})
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('/communities page should redirect to the only community', function (done) {
		client1.get('http://127.0.0.1:3000/communities')
			.redirects(0)
			.end(function (err, res) {
				expect(res.status).to.equal(302);
				expect(res.headers['location']).to.be('/community/community-one');
				done();
			});
	});

	it('should be able to follow redirect from /communities to only community', function (done) {
		client1.get('http://127.0.0.1:3000/communities')
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('should be able to create annother community', function (done) {
		client1.post('http://127.0.0.1:3000/api/Communities')
			.type('form')
			.send({
				'name': 'community two',
				'nickname': 'community-two',
				'viewPolicy': 'open',
				'postPolicy': 'open'
			})
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('should be able to load communities page (no redirect beacause now more than one community)', function (done) {
		client1.get('http://127.0.0.1:3000/communities')
			.redirects(0)
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.equal(200);
				done();
			});
	});

	it('user1 should be able to join community-one', function (done) {
		client1.get('http://127.0.0.1:3000/join?endpoint=' + 'http://127.0.0.1:3000/community-one').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body.status).to.equal('ok');
			done();
		});
	});

	it('user1 should not able to join community-one again', function (done) {
		client1.get('http://127.0.0.1:3000/join?endpoint=' + 'http://127.0.0.1:3000/community-one').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body.status).to.equal('duplicate subscription request');
			done();
		});
	});

	it('user1 should be able to accept user-one as a member', function (done) {
		client1.get('http://127.0.0.1:3000/community-one/accept-member?endpoint=' + 'http://127.0.0.1:3000/user-one').end(function (err, res) {
			console.log('body', res.body);
			expect(res.status).to.be(200);
			expect(res.body.status).to.equal('ok');
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
