// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var resolveProfiles = require('../lib/resolveProfiles');
var utils = require('../lib/utilities');
var mailer = require('../lib/mail');
var dataEventHandler = require('../lib/websocketDataEventHandler');

var uuid = require('uuid');
var VError = require('verror').VError;
var async = require('async');

var debug = require('debug')('antisocial-friends');

module.exports = function (server) {
	server.on('started', function (listener) {
		var antisocial = require('antisocial-friends');
		var db = require('../lib/antisocial-module-db-adaptor')(server);

		function getLoggedInUser(req, res, next) {
			var token;
			if (req.cookies && req.cookies.access_token) {
				token = req.cookies.access_token;
			}

			if (req.signedCookies && req.signedCookies.access_token) {
				token = req.signedCookies.access_token;
			}

			if (!token) {
				return next();
			}

			async.waterfall([
				function (cb) {
					server.models.AccessToken.resolve(token, function (err, tokenInstance) {
						if (err || !tokenInstance) {
							return cb(null, null);
						}
						cb(err, tokenInstance);
					});

				},
				function (token, cb) {
					if (!token) {
						return cb();
					}
					server.models.MyUser.findById(token.userId, function (err, user) {
						cb(err, user);
					});
				}
			], function (err, user) {
				req.antisocialUser = user;
				next();
			});
		}

		server.locals.config.APIPrefix = '';
		var antisocialApp = antisocial(server, server.locals.config, db, getLoggedInUser);

		var watchFeed = antisocialApp.activityFeed;

		server.antisocialApp = antisocialApp;

		// notify requestor that their friend request was accepted
		antisocialApp.on('new-friend', function (user, friend) {

			async.waterfall([

				function (cb) { // tell my friends about my new friend
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
						cb(null, item);
					});
				},
				function (pushItem, cb) { // notify self
					if (!friend.originator) {
						return async.setImmediate(function () {
							return cb(null);
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
						cb(null);
					});
				}
			], function (err) {
				if (err) {
					server.locals.logger('error', 'error occured doing notifications for friend-request-accepted event', err.message);
				}
				else {
					if (friend.originator) {
						watchFeed.connect(user, friend);
					}
				}
			});
		});

		// notify recipient of new friend request
		antisocialApp.on('new-friend-request', function (user, friend) {
			// do notifications
			async.waterfall([
				function getProfile(cb) {
					resolveProfiles(friend, function (err) {
						if (err) {
							var e = new VError(err, 'error resolving profile');
							return cb(e);
						}

						var profile = friend.resolvedProfiles[friend.remoteEndPoint];

						cb(null, profile);
					});
				},
				function postNewsFeedPendingFriendRequest(profile, cb) {
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
						cb(null, profile, item);
					});
				},
				function notifyEmail(profile, item, cb) {
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

		// friend has changed
		antisocialApp.on('friend-updated', function (user, friend) {
			debug('antisocial friend-updated %j', friend.remoteEndPoint);
		});

		// friend has been deleted
		antisocialApp.on('friend-deleted', function (user, friend) {
			if (friend.originator) {
				watchFeed.disConnect(server, friend);
			}

			async.series([
				function (cb) {
					// delete news feed entries by originating from deleted friend
					server.models.NewsFeedItem.destroyAll({
						'and': [{
							'source': friend.remoteEndPoint
						}, {
							'userId': friend.userId
						}]
					}, function (err, info) {
						if (err) {
							var e = new VError(err, 'error occured deleting newsFeedItems (source)');
							return cb(e);
						}
						debug('friend-deleted NewsFeedItems removed: ', info);
						cb();
					});
				},
				function (cb) {
					// mark push notifications for my actions on items originating from deleted friend as deleted
					server.models.PushNewsFeedItem.find({
						'where': {
							'and': [{
								'about': {
									'like': new RegExp('^' + friend.remoteEndPoint + '.*')
								}
							}, {
								'userId': friend.userId
							}]
						}
					}, function (err, items) {
						if (err) {
							var e = new VError(err, 'error occured deleting PushNewsFeedItems (about)');
							return cb(e);
						}

						for (var i = 0; i < items.length; i++) {
							items[i].deleted = true;
							items[i].save();
						}

						debug('friend-deleted NewsFeedItems marked as deleted', items ? items.length : 0);
						cb();
					});
				},
				function (cb) {
					// delete news feed items for my actions on items originating from deleted friend
					server.models.NewsFeedItem.destroyAll({
						'and': [{
							'about': {
								'like': new RegExp('^' + friend.remoteEndPoint + '.*')
							}
						}, {
							'userId': friend.userId
						}]
					}, function (err, info) {
						if (err) {
							var e = new VError(err, 'error occured deleting newsFeedItems (about)');
							return cb(e);
						}
						debug('friend-deleted NewsFeedItems removed: ', info);
						cb();
					});
				}
			], function (err) {
				if (err) {
					server.locals.logger('error', 'error occured for friend-deleted event', err.message);
				}
			});
		});

		antisocialApp.on('open-activity-connection', function (user, friend, emitter, info) {

			// set up data observer for PushNewsFeedItem which emits data events on socket for 'after save' events
			var handler = server.models.PushNewsFeedItem.buildWebSocketChangeHandler(emitter, user, friend);
			info.observers = [{
				'model': 'PushNewsFeedItem',
				'eventType': 'after save',
				'handler': handler
			}];
			server.models.PushNewsFeedItem.observe('after save', handler);
			emitter('as-post', 'highwater', friend.highWater['as-post'] ? friend.highWater['as-post'] : 0);
		});

		antisocialApp.on('activity-data-as-post', function (user, friend, data) {
			dataEventHandler(server, user, friend, data);
		});

		antisocialApp.on('activity-backfill-as-post', function (user, friend, highwater, emitter) {
			server.models.PushNewsFeedItem.changeHandlerBackfill(emitter, user, friend, highwater ? highwater : 0);
		});

		antisocialApp.on('close-activity-connection', function (user, friend, reason, info) {

			// remove data observers
			var observers = info.observers;
			if (observers) {
				for (var i = 0; i < observers.length; i++) {
					var observer = observers[i];
					server.models[observer.model].removeObserver(observer.eventType, observer.handler);
				}
			}

			if (friend.originator) {
				setTimeout(function () {
					watchFeed.connect(user, friend);
				}, 60000);
			}
		});

		antisocialApp.on('open-notification-connection', function (user, emitter, info) {
			var handler = server.models.NewsFeedItem.buildWebSocketChangeHandler(emitter, user);
			info.observers = [{
				'model': 'NewsFeedItem',
				'eventType': 'after save',
				'handler': handler
			}];
			server.models.NewsFeedItem.observe('after save', handler);

		});

		antisocialApp.on('notification-data-as-post', function (user, data) {
			console.log('notifications got %j from %s', data, user.username);
		});

		antisocialApp.on('notification-backfill-as-post', function (user, highwater, emitter) {
			server.models.NewsFeedItem.changeHandlerBackfill(emitter, user, highwater ? highwater : 0);
		});

		antisocialApp.on('close-notification-connection', function (user, reason, info) {
			var observers = info.observers;
			if (observers) {
				for (var i = 0; i < observers.length; i++) {
					var observer = observers[i];
					server.models[observer.model].removeObserver(observer.eventType, observer.handler);
				}
			}
		});

		antisocialApp.listen(listener);

	});
};
