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
	var postPhoto;
	var postPhotoUUID;
	var commentId;
	var photoCommentId;

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
				console.log('request friend %j', res.body);
				expect(res.status).to.be(200);
				expect(res.body.status).to.equal('ok');
				done();
			});
		});

		it('user2 should be able to accept friend request from user1', function (done) {
			client2.get('http://127.0.0.1:3000/accept-friend?endpoint=' + encodeURIComponent(endpoint1)).end(function (err, res) {
				console.log('accept friend %j', res.body);
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
			console.log('post public %j', res.body);
			post1 = res.body.uuid;
			done();
		});
	});

	it('user 2 should be able to upload a post photo', function (done) {
		var url = 'http://localhost:3000/pending-upload';
		var file = 'tests/images/test-image.jpg';

		client2.post(url).attach('file', file)
			.end(function (err, res) {
				expect(err).to.be(null);
				expect(res.status).to.be(200);
				console.log('upload photo %j', res.body);
				postPhoto = res.body.id;
				done();
			});
	});

	it('user2 should be able to post (friends only)', function (done) {
		var payload = {
			'body': 'Hello world',
			'visibility': ['friends'],
			'photos': [{
				'id': postPhoto,
				'title': 'photo Title',
				'description': 'photo Description'
			}]
		};

		client2.post('http://127.0.0.1:3000/post').send(payload).end(function (err, res) {
			console.log(res.body);
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('post w/photo %j', res.body);
			expect(res.body.status).to.be('ok');
			post2 = res.body.uuid;
			done();
		});
	});

	it('user1 should be able to react to user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('react to post %j', res.body);
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
			console.log('comment on post %j', res.body);
			expect(res.body.status).to.be('ok');
			commentId = res.body.comment.uuid;
			done();
		});
	});

	it('user1 should be able to react to comment on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2 + '/comment/' + commentId
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('react to post comment %j', res.body);
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to get user2 profile (json)', function (done) {
		client2.get('http://127.0.0.1:3000/proxy-profile?format=json&endpoint=' + encodeURIComponent(endpoint2)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('profile %j', res.body);
			done();
		});
	});

	it('user1 should be able to get user2 profile (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-profile?endpoint=' + encodeURIComponent(endpoint2)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<head>');
			done();
		});
	});

	it('user1 should be able to get user2 posts (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-posts?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('posts %j', res.body);
			expect(res.body.posts.length).to.be(2);
			done();
		});
	});

	it('user1 should be able to get user2 posts (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-posts?endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('anon user should be able to get user2 public posts (json)', function (done) {
		clientAnon.get('http://127.0.0.1:3000/proxy-posts?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/posts')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('public posts %j', res.body);
			expect(res.body.posts.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to get user2 post (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post1)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('post %j', res.body);
			expect(res.body.post).to.be.an('object');
			expect(res.body.post.uuid).to.equal(post1);
			done();
		});
	});

	it('user1 should be able to get user2 post (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			expect(res.text).to.contain('<div id="scope-post-list">');
			done();
		});
	});

	it('user1 should be able to get user2 post reactions (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-reactions?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('reactions %j', res.body);
			expect(res.body.reactions).to.be.an('object');
			expect(res.body.reactions.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to get user2 post reactions (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-reactions?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post comments (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comments?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comments')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('comments %j', res.body);
			expect(res.body.comments).to.be.an('object');
			expect(res.body.comments.length).to.be(1);
			done();
		});
	});

	it('user1 should be able to get user2 post comments (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comments?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comments')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post comment (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comment?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comment/' + commentId)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('comment %j', res.body);
			expect(res.body.comment).to.be.an('object');
			expect(res.body.comment.uuid).to.equal(commentId);
			done();
		});
	});

	it('user1 should be able to get user2 post comment (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comment?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comment/' + commentId)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post comment reactions (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comment-reactions?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comment/' + commentId + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('comment reactions %j', res.body);
			expect(res.body.commentReactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post comment reactions (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-comment-reactions?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/comment/' + commentId + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});


	it('user1 should be able to get user2 post photos (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photos?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photos')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photos %j', res.body);
			expect(res.body.photos).to.be.an('array');
			expect(res.body.photos.length).to.be(1);
			postPhotoUUID = res.body.photos[0].uuid;
			done();
		});
	});

	it('user1 should be able to get user2 post photos (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photos?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photos')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to comment on photo on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/comment').send({
			'body': 'a comment',
			'about': endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('comment on post %j', res.body);
			expect(res.body.status).to.be('ok');
			photoCommentId = res.body.comment.uuid;
			done();
		});
	});

	it('user1 should be able to react to photo on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('react to post photo %j', res.body);
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to react to comment on photo on user2 post', function (done) {
		client1.post('http://127.0.0.1:3000/react').send({
			reaction: 'thumbsup',
			endpoint: endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId
		}).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('comment to post photo %j', res.body);
			expect(res.body.status).to.be('ok');
			done();
		});
	});

	it('user1 should be able to get user2 post photo (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photo %j', res.body);
			expect(res.body.photo).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post photo (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post photo reactions (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-reactions?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photo reactions %j', res.body);
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post photo reactions (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-reactions?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comments (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comments?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photos comments %j', res.body);
			expect(res.body.comments).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comments (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comments?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comments')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comment (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comment?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photos comment %j', res.body);
			expect(res.body.comment).to.be.an('object');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comment (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comment?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId)).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.headers['content-type']).to.be('text/html; charset=utf-8');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comment reactions (json)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comment-reactions?format=json&endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions')).end(function (err, res) {
			expect(res.status).to.be(200);
			expect(res.body).to.be.an('object');
			expect(res.headers['content-type']).to.be('application/json; charset=utf-8');
			console.log('photos comment %j', res.body);
			expect(res.body.reactions).to.be.an('array');
			done();
		});
	});

	it('user1 should be able to get user2 post photo comment reactions (html)', function (done) {
		client1.get('http://127.0.0.1:3000/proxy-post-photo-comment-reactions?endpoint=' + encodeURIComponent(endpoint2 + '/post/' + post2 + '/photo/' + postPhotoUUID + '/comment/' + photoCommentId + '/reactions')).end(function (err, res) {
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
