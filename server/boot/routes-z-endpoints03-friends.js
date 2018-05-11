var getCurrentUser = require('../middleware/context-currentUser');
var getFriendAccess = require('../middleware/context-getFriendAccess');
var checkNeedProxyRewrite = require('../middleware/rewriteUrls');
var resolveProfiles = require('../lib/resolveProfiles');
var encryption = require('../lib/encryption');
var getProfile = require('../lib/getProfile');
var async = require('async');
var debug = require('debug')('proxy');
var request = require('request');
var graphlib = require('graphlib');
var utils = require('../lib/endpoint-utils');

var friendsRE = /^\/((?!proxy-)[a-zA-Z0-9-]+)\/friends(\.json)?(\?.*)?$/;

module.exports = function (server) {
	var router = server.loopback.Router();

	/**
	 * Retrieve a list of a user's friends as HTML or JSON
	 * The friends being requested could be of a user's on the server or a
	 * friend of a user on the server. If the request is anonymous, only
	 * public information is returned. If the request is for HTML the
	 * response may include the user's photos either public or, if the
	 * requestor is a friend, photos based on the visibility allowed for the
	 * requestor.
	 *
	 * @name Get user's photos as JSON object or as an HTML page
	 * @route {GET} /:username[.json]
	 * @routeparam {String} :username Username of user on this server or a friend of the logged in user
	 * @routeparam {String} .json Append the .json suffix for JSON response otherwise HTML is returned
	 	 * @queryparam {String} tags Filter photos by tags. eg. ?tags=["%23randompic"] returns only photos hashtagged with #randompic (HTML mode only)
	 * @authentication Anonymous, with valid user credentials or with valid friend credentials
	 * @headerparam {String} friend-access-token Request made by a friend of :username. Must match remoteAccessToken in one of :username's FRIEND records
	 * @headerparam {Cookie} access_token Request made by a logged in user on this server (set when user logges in.)
	 * @returns {JSON} If .json is requested returns a user profile object
	 * @returns {HTML} If .json not requested return user profile page (which includes several posts)
	 	 */

	router.get(friendsRE, getCurrentUser(), checkNeedProxyRewrite('friends'), getFriendAccess(), function (req, res, next) {
		var ctx = req.myContext;
		var redirectProxy = ctx.get('redirectProxy');
		if (redirectProxy) {
			return next();
		}

		var currentUser = ctx.get('currentUser');
		var userSettings = ctx.get('userSettings');

		var friend = ctx.get('friendAccess');

		var matches = req.url.match(friendsRE);
		var username = matches[1];
		var view = matches[2];
		var hashes = req.query.hashes ? req.query.hashes.split(/,/) : [];

		var isMe = false;
		var endpoints = [];
		var map = {};

		utils.getUser(username, function (err, user) {
			if (err) {
				if (err.statusCode === 404) {
					return res.sendStatus(404);
				}
				return next(err);
			}

			if (!user) {
				return res.sendStatus(404);
			}

			if (currentUser) {
				if (currentUser.id.toString() === user.id.toString()) {
					isMe = true;
				}
			}

			// only logged in user or friends can access frields list
			if (!friend && !isMe) {
				return res.sendStatus(401);
			}

			if (isMe) { // get all friends of my friends
				var g = new graphlib.Graph({
					directed: false
				});

				var query = {
					'where': {
						'and': [{
							'userId': currentUser.id
						}, {
							'status': 'accepted'
						}]
					}
				};

				server.models.Friend.find(query, function (err, friends) {

					g.setNode(server.locals.config.publicHost + '/' + currentUser.username, {
						'name': currentUser.name
					});

					var hashes = [];
					for (var i = 0; i < friends.length; i++) {
						hashes.push(friends[i].hash);
						g.setNode(friends[i].remoteEndPoint, {
							'name': friends[i].remoteName
						});
					}

					async.map(friends, function (friend, cb) {

						var options = {
							'url': friend.remoteEndPoint + '/friends.json?hashes=' + hashes.join(','),
							'headers': {
								'friend-access-token': friend.remoteAccessToken
							},
							'json': true
						};

						request.get(options, function (err, response, body) {

							if (err || response.statusCode !== 200) {
								return cb(); // ignore error?
							}

							var data = body;

							if (friend && body.sig) {
								debug('got encrypted response');
								var privateKey = friend.keys.private;
								var publicKey = friend.remotePublicKey;
								var toDecrypt = body.data;
								var sig = body.sig;
								var pass = body.pass;

								var decrypted = encryption.decrypt(publicKey, privateKey, toDecrypt, pass, sig);
								if (!decrypted.valid) {
									return res.sendStatus('401');
								}
								data = JSON.parse(decrypted.data);
							}

							if (data.friends && data.friends.nodes) {
								for (var i = 0; i < data.friends.nodes.length; i++) {
									var node = data.friends.nodes[i];
									if (!g.hasNode(node.v)) {
										g.setNode(node.v, {
											'name': node.value.name
										});
									}
								}
								for (var i = 0; i < data.friends.edges.length; i++) {
									var edge = data.friends.edges[i];
									g.setEdge(edge.v, edge.w);
								}
							}

							cb();

						});
					}, function (err) {
						var results = graphlib.json.write(g);
						async.map(results.nodes, function (node, cb) {
							node.about = node.v;
							resolveProfiles(node, cb);
						}, function (err) {

							var data = {
								'pov': {
									'user': user.username,
									'isMe': isMe,
									'friend': friend ? friend.remoteUsername : false,
									'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
								},
								'me': server.locals.config.publicHost + '/' + currentUser.username,
								'profile': getProfile(user),
								'friends': results
							};

							if (view === '.json') {
								return res.send(utils.encryptIfFriend(friend, data));
							}
							else {
								var friendMap = {};
								for (var i = 0; i < currentUser.friends().length; i++) {
									var f = currentUser.friends()[i];
									friendMap[f.remoteEndPoint] = f;
								}

								var options = {
									'data': data,
									'user': currentUser,
									'friend': friend,
									'isMe': isMe,
									'friendMap': friendMap,
									'myEndpoint': utils.getPOVEndpoint(friend, currentUser)
								};

								utils.renderFile('/components/rendered-friends.pug', options, req, function (err, html) {
									if (err) {
										return next(err);
									}
									return res.send(utils.encryptIfFriend(friend, html));
								});
							}
						});
					});
				});
			}
			else { // get friends
				var g = new graphlib.Graph({
					directed: false
				});

				var query = {
					'where': {
						'and': [{
							'userId': user.id
						}, {
							'status': 'accepted'
						}]
					}
				};

				utils.getUserSettings(user, function (err, userSettings) {


					server.models.Friend.find(query, function (err, friends) {

						if (userSettings.friendListVisibility !== 'none') {
							g.setNode(server.locals.config.publicHost + '/' + user.username, {
								'name': user.name
							});

							for (var i = 0; i < friends.length; i++) {
								var allowed = true;
								if (userSettings.friendListVisibility === 'mutual') {
									if (hashes.indexOf(friend.hash) === -1) {
										allowed = false;
									}
								}
								if (allowed) {
									g.setNode(friends[i].remoteEndPoint, {
										'name': friends[i].remoteName
									});
									g.setEdge(server.locals.config.publicHost + '/' + user.username, friends[i].remoteEndPoint);
								}
							}
						}

						var data = {
							'pov': {
								'user': user.username,
								'isMe': isMe,
								'friend': friend ? friend.remoteUsername : false,
								'visibility': friend ? friend.audiences : isMe ? 'all' : 'public'
							},
							'profile': getProfile(user),
							'friends': graphlib.json.write(g)
						};

						if (view === '.json') {
							return res.send(utils.encryptIfFriend(friend, data));
						}
						else {
							var options = {
								'data': data,
								'user': currentUser,
								'friend': friend,
								'isMe': isMe,
								'myEndpoint': utils.getPOVEndpoint(friend, currentUser)
							};

							utils.renderFile('/components/rendered-friends.pug', options, req, function (err, html) {
								if (err) {
									return next(err);
								}
								return res.send(utils.encryptIfFriend(friend, html));
							});
						}
					});
				});
			}
		});
	});

	server.use(router);
};
