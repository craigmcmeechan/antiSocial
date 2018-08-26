// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var watchFeed = require('../lib/websocketWatchFriend');
var resolveProfiles = require('../lib/resolveProfiles');
var utils = require('../lib/utilities');
var mailer = require('../lib/mail');

var uuid = require('uuid');
var VError = require('verror').VError;
var async = require('async');

var debug = require('debug')('friends');

module.exports = function (server) {

	var antisocial = require('antisocial-friends');
	var db = require('../lib/antisocial-module-db-adaptor')(server);

	server.locals.config.APIPrefix = '';
	var antisocialApp = antisocial(server, server.locals.config, db, getCurrentUser());

	// notify requestor that their friend request was accepted
	antisocialApp.on('new-friend', function (e) {
		var friend = e.friend;

		if (friend.originator) {
			watchFeed.connect(server, friend);
		}

		async.waterfall([
			function getUser(cb) {
				server.models.MyUser.findById(friend.userId, function (err, user) {
					cb(err, user);
				});
			},
			function (user, cb) { // tell my friends about my new friend
				var item = {
					'userId': user.id,
					'uuid': uuid(),
					'type': 'friend',
					'source': server.locals.config.publicHost + '/' + user.username,
					'about': friend.remoteEndPoint,
					'visibility': ['friends'],
					'details': {}
				};
				server.models.PushNewsFeedItem.create(item, function (err, item) {
					if (err) {
						return cb(new VError(err, 'could not create PushNewsFeedItem %j', item));
					}
					cb(null, user, item);
				});
			},
			function (user, pushItem, cb) { // notify self
				if (!friend.originator) {
					return async.setImmediate(function () {
						return cb();
					});
				}

				var item = {
					'userId': user.id,
					'friendId': friend.id,
					'uuid': pushItem.uuid,
					'type': 'friend',
					'source': friend.remoteEndPoint,
					'about': friend.remoteEndPoint
				};
				server.models.NewsFeedItem.create(item, function (err, item) {
					if (err) {
						return cb(new VError(err, 'could not create PushNewsFeedItem %j', item));
					}
					cb(null, friend);
				});
			}
		], function (err) {
			if (err) {
				server.locals.logger('error', 'error occured doing notifications for friend-request-accepted event', err.message);
			}
		});
	});

	// notify recipient of new friend request
	antisocialApp.on('new-friend-request', function (e) {
		var friend = e.friend;

		watchFeed.connect(server, friend);

		// do notifications
		async.waterfall([
			function getUser(cb) {
				server.models.MyUser.findById(friend.userId, function (err, user) {
					cb(err, user);
				});
			},
			function getProfile(user, cb) {
				resolveProfiles(friend, function (err) {
					if (err) {
						var e = new VError(err, 'error resolving profile');
						return cb(e);
					}

					var profile = friend.resolvedProfiles[friend.remoteEndPoint];

					cb(null, user, profile);
				});
			},
			function postNewsFeedPendingFriendRequest(user, profile, cb) {
				debug('/friend-request postNewsFeedPendingFriendRequest');

				var myNewsFeedItem = {
					'userId': user.id,
					'friendId': friend.id,
					'uuid': uuid(),
					'type': friend.invitation ? 'friend invite accepted' : 'pending friend request',
					'source': friend.remoteEndPoint,
					'about': friend.remoteEndPoint,
					'originator': false
				};

				server.models.NewsFeedItem.create(myNewsFeedItem, function (err, item) {
					if (err) {
						var e = new VError(err, 'error creating newsfeed item');
						return cb(e);
					}
					cb(null, user, profile, item);
				});
			},
			function notifyEmail(user, profile, item, cb) {
				utils.getUserSettings(server, user, function (err, settings) {
					if (!settings.notifications_friend_request) {
						return cb(null);
					}
					var template = 'emails/notify-friend-request';
					var options = {
						'to': user.email,
						'from': process.env.OUTBOUND_MAIL_SENDER,
						'config': server.locals.config,
						'subject': 'Friend request from ' + friend.remoteUsername,
						'profile': profile ? profile.profile : null,
						'_': require('lodash'),
						'marked': server.locals.marked,
						'item': item
					};
					mailer(server, template, options, function (err, info) {
						debug('mail status %j %j', err, info);
					});
					cb(null);
				});
			}
		], function (err) {
			if (err) {
				server.locals.logger('error', 'error occured doing notificationd for new-friend-request event', err.message);
			}
		});
	});

	antisocialApp.on('friend-updated', function (e) {
		console.log('antisocial friend-updated %j', e.friend.remoteEndPoint);
	});

	antisocialApp.on('friend-deleted', function (e) {
		if (e.friend.originator) {
			watchFeed.disconnect(server, e.friend);
		}
	});
};
