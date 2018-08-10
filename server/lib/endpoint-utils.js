// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var pug = require('pug');
var debug = require('debug')('proxy');
var server = require('../server');
var encryption = require('antisocial-encryption');

module.exports.getPOVEndpoint = function (friend, currentUser) {
	if (friend) {
		return friend.remoteEndPoint;
	}
	if (currentUser) {
		return server.locals.config.publicHost + '/' + currentUser.username;
	}
};

module.exports.encryptIfFriend = function (friend, payload) {
	if (friend) {
		var privateKey = friend.keys.private;
		var publicKey = friend.remotePublicKey;
		var encrypted = encryption.encrypt(publicKey, privateKey, JSON.stringify(payload));

		payload = {
			'data': encrypted.data,
			'sig': encrypted.sig,
			'pass': encrypted.pass
		};
	}

	return payload;
};

module.exports.getUser = function (username, cb) {
	server.models.MyUser.findOne({
		'where': {
			'username': username
		},
		'include': ['uploads', ]
	}, function (err, user) {
		if (err) {
			return cb(err);
		}
		if (!user) {
			err = new Error('User Not Found');
			err.statusCode = 404;
			return cb(err);
		}
		cb(null, user);
	});
};

module.exports.getUserSettings = function (user, cb) {
	var q = {
		'where': {
			'group': user.username
		}
	};

	server.models.Settings.findOne(q, function (err, group) {
		var settings;
		if (group) {
			settings = group.settings;
		}
		if (!settings) {
			settings = {
				'friendListVisibility': 'all', // all, mutual, none
				'feedSortOrder': 'activity' // post, activity
			};
		}
		cb(null, settings);
	});
};

module.exports.getPosts = function (user, friend, highwater, isMe, tags, cb) {

	var query = {
		'where': {
			'and': [{
				'userId': user.id
			}]
		},
		'order': 'createdOn DESC',
		'limit': 10
	};

	if (!isMe) {
		query.where.and.push({
			'posted': true
		});
		query.where.and.push({
			'visibility': {
				'inq': friend && friend.audiences ? friend.audiences : ['public']
			}
		});
	}

	if (highwater) {
		query.where.and.push({
			'createdOn': {
				'lt': highwater
			}
		});
	}

	if (tags) {
		try {
			tags = JSON.parse(tags);
		}
		catch (e) {
			tags = [];
		}
		query.where.and.push({
			'tags': {
				'inq': tags
			}
		});
	}

	debug('getPosts: %j', query);

	server.models.Post.find(query, function (err, posts) {
		if (err) {
			return cb(err);
		}

		cb(err, posts);
	});
};

module.exports.getPost = function (postId, user, friend, subscription, isMe, cb) {
	var query = {
		'where': {
			'and': [{
				'uuid': postId
			}, {
				'userId': user.id
			}]
		}
	};

	if (!isMe) {
		if (subscription) {
			query.where.and.push({
				'visibility': {
					'inq': ['community:' + subscription.communityName]
				}
			});
		}
		else {
			query.where.and.push({
				'visibility': {
					'inq': friend && friend.audiences ? friend.audiences : ['public']
				}
			});
		}
	}

	debug('getPost: %j', query);

	server.models.Post.findOne(query, function (err, post) {
		if (err) {
			return cb(err);
		}

		if (!post) {
			err = new Error('Post not found');
			err.statusCode = 404;
			return cb(err);
		}

		cb(null, post);
	});
};

module.exports.getPhoto = function (photoId, user, friend, cb) {
	var query = {
		'where': {
			'and': [{
				'uuid': photoId
			}, {
				'userId': user.id
			}]
		},
		'include': ['uploads']
	};

	debug('getPhoto: %j', query);

	server.models.Photo.findOne(query, function (err, photo) {
		if (err) {
			return cb(err);
		}

		if (!photo) {
			err = new Error('Photo not found');
			err.statusCode = 404;
			return cb(err);
		}

		cb(null, photo);
	});
};

module.exports.renderFile = function (template, data, req, cb) {
	var ctx = req.myContext;

	var options = {};

	for (var prop in data) {
		options[prop] = data[prop];
	}

	for (var prop in server.locals) {
		options[prop] = server.locals[prop];
	}

	if (process.env.NODE_ENV === 'production') {
		options.cache = true;
	}

	options.globalSettings = ctx.get('globalSettings');

	pug.renderFile(server.get('views') + template, options, function (err, html) {
		if (err) {
			return cb(err);
		}
		cb(null, html);
	});
};
