var request = require('superagent');
var assert = require('assert');
var expect = require('expect.js');
var uuid = require('uuid');
var async = require('async');

/*
NODE_ENV=localdev PUBLIC_HOST=127.0.0.1 PUBLIC_PROTOCOL=http PUBLIC_PORT=3000 PORT=3000 LOCAL_UPLOADS=true ACCESS_LOG=dev DEBUG=proxy node . &
NODE_ENV=localdev PUBLIC_HOST=127.0.0.1 PUBLIC_PROTOCOL=http PUBLIC_PORT=3001 PORT=3001 LOCAL_UPLOADS=true ACCESS_LOG=dev DEBUG=proxy node . &
*/

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

	var server1 = 'http://127.0.0.1:3000';
	var server2 = 'http://127.0.0.1:3001';


	var endpoint1 = server1 + '/';
	var endpoint2 = server2 + '/';
	var endpoint3 = server1 + '/';
	var endpoint4 = server2 + '/';
	var endpoint5 = server1 + '/';

	var userID1, userID2, userID3, userID4, userID5;
	var userName1, userName2, userName3, userName4, userName5;


	var password = 'testing123';
	var post1;
	var post2;
	var postPhoto;
	var postCommentPhoto;
	var postCommentPhotoUUID;
	var postPhotoUUID;
	var commentId;
	var photoCommentId;


	it('http 3000 should be up', function (done) {
		client1
			.get(server1)
			.end(function (err, res) {
				expect(err).to.be(null);
				assert.equal(res.status, 200);
				done();
			});
	});

	it('http 30001 should be up', function (done) {
		client1
			.get(server2)
			.end(function (err, res) {
				expect(err).to.be(null);
				assert.equal(res.status, 200);
				done();
			});
	});

	var needSetup = true;

	if (needSetup) {

		it('should be able to create account 1', function (done) {
			client1.post(server1 + '/api/MyUsers/register')
				.type('form')
				.send({
					'email': email1,
					'password': password,
					'name': 'user one'
				})
				.end(function (err, res) {
					expect(err).to.be(null);
					expect(res.status).to.equal(200);
					var accessToken = getCookie(res.headers['set-cookie'], 'access_token');
					expect(accessToken).to.be.a('string');
					endpoint1 += res.body.result.username;
					userID1 = res.body.result.id;
					userName1 = res.body.result.username;
					done();
				});
		});

		it('should be able to create account 2', function (done) {
			client2.post(server2 + '/api/MyUsers/register')
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
					userName2 = res.body.result.username;
					done();
				});
		});

		it('should be able to create account 3', function (done) {
			client3.post(server1 + '/api/MyUsers/register')
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
					userName3 = res.body.result.username;
					done();
				});
		});

		it('should be able to create account 4', function (done) {
			client4.post(server2 + '/api/MyUsers/register')
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
					userName4 = res.body.result.username;
					done();
				});
		});

		it('should be able to create account 5', function (done) {
			client5.post(server1 + '/api/MyUsers/register')
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
					endpoint5 += res.body.result.username;
					userID5 = res.body.result.id;
					userName5 = res.body.result.username;
					done();
				});
		});

		it('user1 should be able to friend user2', function (done) {
			console.log(endpoint1 + '/request-friend?endpoint=' + endpoint2);
			client1.get(endpoint1 + '/request-friend?endpoint=' + endpoint2).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user2 should be able to accept friend request from user1', function (done) {
			client2.post(endpoint2 + '/friend-request-accept')
				.send({
					'endpoint': endpoint1
				})
				.end(function (err, res) {
					expect(res.status).to.be(200);
					expect(res.body.status).to.equal('ok');
					done();
				});
		});

		it('user3 should be able to friend user1', function (done) {
			client3.get(endpoint3 + '/request-friend?endpoint=' + endpoint1).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user1 should be able to accept friend request from user3', function (done) {
			client1.post(endpoint1 + '/friend-request-accept')
				.send({
					'endpoint': endpoint3
				})
				.end(function (err, res) {
					expect(res.status).to.be(200);
					expect(res.body.status).to.equal('ok');
					done();
				});
		});

		it('user4 should be able to friend user2', function (done) {
			client4.get(endpoint4 + '/request-friend?endpoint=' + endpoint2).end(function (err, res) {
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user2 should be able to accept friend request from user4', function (done) {
			client2.post(endpoint2 + '/friend-request-accept')
				.send({
					'endpoint': endpoint4
				})
				.end(function (err, res) {
					expect(res.status).to.be(200);
					expect(res.body.status).to.equal('ok');
					done();
				});
		});
	}

	it('user2 should be able to post (public)', function (done) {
		client2.post(server2 + '/post').send({
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
		var url = server2 + '/pending-upload';
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

		client2.post(server2 + '/post').send(payload).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.result.status).to.be('ok');
			post2 = res.body.result.uuid;
			done();
		});
	});


	it('user2 should be able to post (friends only) w/tags', function (done) {
		var payload = {
			'body': 'Hello world [hashtag](tag-hash-hashtag) [user one](tag-user-' + endpoint1 + ')',
			'visibility': ['friends'],
		};

		client2.post(server2 + '/post').send(payload).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.result.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to react to user2 post', function (done) {
		client1.post(server1 + '/react').send({
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
		client1.post(server1 + '/comment').send({
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
		client1.post(server1 + '/react').send({
			reaction: 'vomit',
			endpoint: endpoint2 + '/post/' + post2 + '/comment/' + commentId
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to upload a post comment photo', function (done) {
		var url = server1 + '/pending-upload';
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
		client1.post(server1 + '/comment').send({
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
		client1.get(server1 + '/' + userName2 + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 profile (html)', function (done) {
		client1.get(server1 + '/' + userName2).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<head>');
			done();
		});
	});

	it('user1 should be able to get all user2 posts (json)', function (done) {
		console.log(server1 + '/' + userName2 + '/posts.json');
		client1.get(server1 + '/' + userName2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user1 should be able to get all user2 posts (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/posts').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('user1 should be able to get user2 tagged posts (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/posts.json?tags=["@' + endpoint1 + '"]').end(function (err, res) {
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
		client4.get(server2 + '/' + userName2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user2 should be able to get all user 2 posts (json)', function (done) {
		client2.get(server2 + '/' + userName2 + '/posts.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.posts.length).to.be(3);
			done();
		});
	});

	it('user1 should be able to get user2 post1 (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post1 + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.post).to.be.an('object');
			expect(res.body.post.uuid).to.equal(post1);
			done();
		});
	});

	it('user1 should be able to get user2 post2 (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('user1 should be able to get user2 post2 reactions (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('object');
			expect(res.body.reactions.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to get user2 post2 reactions (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comments (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comments.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comments).to.be.an('object');
			expect(res.body.comments.length).to.be(2);
			done();
		});
	});

	it('user1 should be able to get user2 post2 comments (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comments').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comment/' + commentId + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comment).to.be.an('object');
			expect(res.body.comment.uuid).to.equal(commentId);
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comment/' + commentId).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment reactions (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comment/' + commentId + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 comment reactions (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/comment/' + commentId + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photos (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photos.json').end(function (err, res) {
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
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photos').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to comment on user2 post2 photo', function (done) {
		client1.post(server1 + '/comment').send({
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
		client1.post(server1 + '/react').send({
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
		client1.post(server1 + '/react').send({
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
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.photo).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo reactions (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo reactions (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comments (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comments).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comments (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.comment).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment reactions (json)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions.json').end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post2 photo comment reactions (html)', function (done) {
		client1.get(server1 + '/' + userName2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions').end(function (err, res) {
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
