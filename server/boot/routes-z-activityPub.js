var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');

module.exports = function (server) {
	var router = server.loopback.Router();

	var personRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)$/;
	var outBoxRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/outbox$/;
	var inBoxRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/inbox$/;
	var followersRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/followers$/;
	var followingRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/following$/;
	var likesRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/likes$/;
	var likedRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/liked$/;
	var sharesRE = /^\/activitypubapi\/([a-zA-Z0-9-]+)\/shares$/;

	router.get(personRE, getCurrentUser(), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var friend = ctx.get('friendAccess');
		var currentUser = ctx.get('currentUser');
		var matches = req.url.match(personRE);
		var username = matches[1];
		getUser(username, function (err, user) {
			if (err) {
				if (err.statusCode === 404) {
					return res.sendStatus(404);
				}
				return next(err);
			}

			var isMe = false;
			if (currentUser) {
				if (currentUser.id.toString() === user.id.toString()) {
					isMe = true;
				}
			}

			res.set('Content-Type', 'application/ld+json');
			res.send({
				'@context': ['https://www.w3.org/ns/activitystreams', {
					'@language': 'en'
				}],
				'type': 'Person',
				'id': server.locals.config.publicHost + '/activitypubapi/' + user.username,
				'following': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/following',
				'followers': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/followers',
				'liked': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/liked',
				'likes': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/likes',
				'shares': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/shares',
				'inbox': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/inbox',
				'outbox': server.locals.config.publicHost + '/activitypubapi/' + user.username + '/outbox',
				'name': user.name,
				'icon': [
					server.locals.getUploadForProperty('photo', user.uploads(), 'thumb', server.locals.config.publicHost + server.locals.headshotFPO).url
				]
			});
		});
	});


	function getUser(username, cb) {
		server.models.MyUser.findOne({
			'where': {
				'username': username
			},
			'include': ['uploads']
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
	}

	server.use(router);
};
