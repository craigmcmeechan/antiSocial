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
	var client3 = request.agent();
	var client4 = request.agent();
	var client5 = request.agent();

	var clientAnon = request.agent();

	var email1 = 'mrhodes+test+proxy1@myantisocial.net';
	var email2 = 'mrhodes+test+proxy2@myantisocial.net';
	var email3 = 'mrhodes+test+proxy3@myantisocial.net';
	var email4 = 'mrhodes+test+proxy4@myantisocial.net';
	var email5 = 'mrhodes+test+proxy5@myantisocial.net';

	var endpoint1 = 'http://127.0.0.1:3000/';
	var endpoint2 = 'http://127.0.0.1:3000/';
	var endpoint3 = 'http://127.0.0.1:3000/';
	var endpoint4 = 'http://127.0.0.1:3000/';

	var userID1, userID2, userID3, userID4;

	var password = 'testing123';
	var post1;
	var post2;
	var postPhoto;
	var postCommentPhoto;
	var postCommentPhotoUUID;
	var postPhotoUUID;
	var commentId;
	var photoCommentId;

	before(function (done) {
		app.start();
		done();
	});

	after(function (done) {
		setTimeout(function () {
			app.stop();
			done();
		}, 8000);
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
					'name': 'user one with many spaces'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					endpoint1 += res.body.result.username;
					userID1 = res.body.result.id;
					done();
				});
		});

		it('should be able to create account 2', function (done) {
			client2.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email2,
					'password': password,
					'name': 'user two'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					endpoint2 += res.body.result.username;
					userID2 = res.body.result.id;
					done();
				});
		});

		it('should be able to create account 3', function (done) {
			client3.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email3,
					'password': password,
					'name': 'user three'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					endpoint3 += res.body.result.username;
					userID3 = res.body.result.id;
					done();
				});
		});

		it('should be able to create account 4', function (done) {
			client4.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email4,
					'password': password,
					'name': 'user four'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					endpoint4 += res.body.result.username;
					userID4 = res.body.result.id;
					done();
				});
		});

		it('should be able to create account 5', function (done) {
			client5.post('http://127.0.0.1:3000/api/MyUsers/register')
				.type('form')
				.send({
					'email': email5,
					'password': password,
					'name': 'user five'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
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

		it('user3 should be able to friend user1', function (done) {
			client3.get('http://127.0.0.1:3000/friend?endpoint=' + endpoint1).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user1 should be able to accept friend request from user3', function (done) {
			client1.get('http://127.0.0.1:3000/accept-friend?endpoint=' + encodeURIComponent(endpoint3)).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user4 should be able to friend user2', function (done) {
			client4.get('http://127.0.0.1:3000/friend?endpoint=' + endpoint2).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user2 should be able to accept friend request from user4', function (done) {
			client2.get('http://127.0.0.1:3000/accept-friend?endpoint=' + encodeURIComponent(endpoint4)).end(function (err, res) {
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
			expect(res.body.result.status).to.be('ok');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			post1 = res.body.result.uuid;
			done();
		});
	});

	it('user2 should be able to upload a post photo', function (done) {
		var url = 'http://localhost:3000/pending-upload';
		var file = 'tests/images/test-image.jpg';

		client2.post(url).attach('file', file)
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.be(200);
				postPhoto = res.body.id;
				done();
			});
	});

	it('user2 should be able to post (friends only)', function (done) {
		var payload = {
			'body': 'Hello world with a markdown link [with a title](https://www.google.com/?utm_1=1&utm_2=2&utm_3=3)\na markdown link with no title \n[](https://www.google.com/?utm_1=1&utm_2=2&utm_3=3)\n\nand a raw link\nhttps://www.google.com/?utm_1=1&utm_2=2&utm_3=3\n\n',
			'visibility': ['friends'],
			'photos': [{
				'id': postPhoto,
				'title': 'photo Title',
				'description': 'photo Description'
			}]
		};

		client2.post('http://127.0.0.1:3000/post').send(payload).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.result.status).to.be('ok');
			post2 = res.body.result.uuid;
			done();
		});
	});


	it('user2 should be able to post (friends only) w/tags', function (done) {
		var payload = {
			'body': 'Hello world [hashtag](tag-hash-hashtag) [user one with many spaces](tag-user-' + endpoint1 + ')',
			'visibility': ['friends'],
		};

		client2.post('http://127.0.0.1:3000/post').send(payload).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.result.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to react to user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbs-up',
			endpoint: endpoint2 + '/post/' + post2
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to comment on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/comment').send({
			'body': 'a comment',
			'about': endpoint2 + '/post/' + post2
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			commentId = res.body.comment.uuid;
			done();
		});
	});

	it('user1 should be able to react to comment on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'vomit',
			endpoint: endpoint2 + '/post/' + post2 + '/comment/' + commentId
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user2 should be able to upload a post comment photo', function (done) {
		var url = 'http://localhost:3000/pending-upload';
		var file = 'tests/images/test-image.jpg';

		client1.post(url).attach('file', file)
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.be(200);
				postCommentPhoto = res.body.id;
				postCommentPhotoUUID = res.body.uuid;
				done();
			});
	});

	it('user1 should be able to comment on user2 post with a photo', function (done) {
		client1.post('http://127.0.0.1:3000/comment').send({
			'body': 'a comment with a photo',
			'about': endpoint2 + '/post/' + post2,
			'photos': [{
				'id': postCommentPhoto
			}]
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			commentId = res.body.comment.uuid;
			done();
		});
	});

	it('user1 should be able to get user2 profile (json)', function (done) {
		client1.get(endpoint2 + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 profile (html)', function (done) {
		client1.get(endpoint2).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<head>');
			done();
		});
	});

	it('user1 should be able to get all user2 posts (json)', function (done) {
		client1.get(endpoint2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user1 should be able to get all user2 posts (html)', function (done) {
		client1.get(endpoint2 + '/posts').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('user1 should be able to get user2 tagged posts (json)', function (done) {
		client1.get(endpoint2 + '/posts.json?tags=["@' + endpoint1 + '"]').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(1);
			done();
		});
	});

	it('anon user should be able to get user2 public posts (json)', function (done) {
		clientAnon.get(endpoint2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(1);
			done();
		});
	});

	it('user3 user should only able to get user2 public posts (json)', function (done) {
		client3.get(endpoint2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(1);
			done();
		});
	});

	it('user4 user should be able to get all user2 posts (json)', function (done) {
		client4.get(endpoint2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user2 should be able to get all user 2 posts (json)', function (done) {
		client2.get(endpoint2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user1 should be able to get user2 post1 (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post1 + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.post).to.be.an('object');
			expect(res.body.post.uuid).to.equal(post1);
			done();
		});
	});

	it('user1 should be able to get user2 post2 (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('user1 should be able to get user2 post2 reactions (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('object');
			expect(res.body.reactions.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to get user2 post2 reactions (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comments (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comments.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comments).to.be.an('object');
			expect(res.body.comments.length).to.be(2);
			done();
		});
	});

	it('user1 should be able to get user2 post2 comments (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comments').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comment/' + commentId + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comment).to.be.an('object');
			expect(res.body.comment.uuid).to.equal(commentId);
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comment/' + commentId).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment reactions (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comment/' + commentId + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment reactions (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/comment/' + commentId + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photos (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photos.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.photos).to.be.an('array');
			expect(res.body.photos.length).to.be(1);
			postPhotoUUID = res.body.photos[0].uuid;
			done();
		});
	});

	it('user1 should be able to get user2 post2 photos (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photos').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to comment on user2 post2 photo', function (done) {
		client1.post('http://127.0.0.1:3000/comment').send({
			'body': 'a comment',
			'about': endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			photoCommentId = res.body.comment.uuid;
			done();
		});
	});

	it('user1 should be able to react to user2 post2 photo', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to react to comment on photo on user2 post2', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.photo).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo reactions (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo reactions (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comments (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comments).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comments (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comment).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment reactions (json)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment reactions (html)', function (done) {
		client1.get(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});


	it('user1 should be able to get user1 comment photo (json)', function (done) {
		client2.get(endpoint1 + '/photo/' + postCommentPhotoUUID + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.photo).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user1 comment photo (html)', function (done) {
		client2.get(endpoint1 + '/photo/' + postCommentPhotoUUID).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	// TODO post notifications to user1 user2 user4 not user3

	it('check notifications about post1', function (done) {
		setTimeout(function () {
			app.models.NewsFeedItem.find({
				'where': {
					'about': endpoint2 + '/post/' + post1
				}
			}, function (err, notifications) {
				expect(err).to.be(null);
				for (var i = 0; i < notifications.length; i++) {
					console.log(notifications[i].about, ' notified user:', notifications[i].userId, 'friend:', notifications[i].friendId || 'self');
				}
				expect(notifications.length).to.be(3);
				done();
			});
		}, 5000);
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
