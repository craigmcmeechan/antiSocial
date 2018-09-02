// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var url = require('url');
var async = require('async');
var VError = require('verror').VError;
var utils = require('./utilities');
var mailer = require('./mail');
var debug = require('debug')('websockets');
var debugVerbose = require('debug')('websockets:verbose');
var watchFeed = require('antisocial-friends/lib/websockets-activity-subscribe')
module.exports = function dataEventHandler(server, currentUser, friend, data) {

	var logger = server.locals.logger;

	var key = currentUser.username + '<-' + friend.remoteEndPoint;

	var message = data;

	if (message.type === 'offline') {
		debugVerbose('watchFeed listener %s received offline message', key);
		return;
	}

	if (message.type === 'online') {
		debugVerbose('watchFeed listener %s received online message', key);
		return;
	}

	var myNewsFeedItem = data.data;

	var query = {
		'where': {
			'and': [{
				'uuid': myNewsFeedItem.uuid
			}, {
				'type': myNewsFeedItem.type
			}, {
				'userId': currentUser.id
			}]
		}
	};

	server.models.NewsFeedItem.findOne(query, function (err, oldNews) {
		if (err) {
			logger.error({
				'err': err,
				'query': query
			}, 'error reading NewsFeedItem item');
			return;
		}

		if (oldNews) {
			if (message.type === 'create') {
				debugVerbose('watchFeed listener ' + currentUser.username + ' skipping old news %j %j', oldNews);
				return;
			}
			else if (message.type === 'remove') {
				oldNews.destroy();
				return;
			}
			else if (message.type === 'update' || message.type === 'backfill') {
				debugVerbose('watchFeed listener ' + currentUser.username + ' updating old news %j %j', oldNews, myNewsFeedItem);
				oldNews.details = myNewsFeedItem.details;
				oldNews.versions = myNewsFeedItem.versions;
				oldNews.deleted = myNewsFeedItem.deleted;
				oldNews.tags = myNewsFeedItem.tags;
				oldNews.save();

				if (myNewsFeedItem.deleted) {

					// cleanup all my interactions with this item
					// the 'about' field has an implied hierarchy
					// endpoint/post/xxx
					// endpoint/post/xxx/comment/xxx
					// endpoint/post/xxx/reaction/xxx
					// endpoint/post/xxx/photo/xxx/comment/xxx
					// etc.
					// so if the post is deleted we should cleanup all the things we did to that post
					// we cand find them all with a regex

					var match = new RegExp('^' + myNewsFeedItem.about + '/');

					if (myNewsFeedItem.type === 'post') {
						match = new RegExp('^' + myNewsFeedItem.about);
					}

					async.series([
						function updateNewsFeedItem(cb) {
							var q = {
								'where': {
									'and': [{
										'userId': currentUser.id
									}, {
										'about': {
											'like': match
										}
									}]
								}
							};
							server.models.NewsFeedItem.find(q, function (err, items) {
								for (var i = 0; i < items.length; i++) {
									items[i].deleted = true;
									items[i].save();
								}
								cb(err);
							});
						},
						function updatePushNewsFeedItem(cb) {
							var q = {
								'where': {
									'and': [{
										'about': {
											'like': match
										}
									}, {
										'userId': currentUser.id
									}]
								}
							};

							server.models.PushNewsFeedItem.find(q, function (err, items) {
								for (var i = 0; i < items.length; i++) {
									items[i].updateAttribute('deleted', true);
								}
								cb(err);
							});
						}
					], function (err) {
						return;
					});
				}
			}
			else {
				debugVerbose('watchFeed listener ' + currentUser.username + ' skipping old news unknown type %s %j %j', message.type, oldNews, myNewsFeedItem);
				return;
			}
		}
		else { // not old news
			if (message.type !== 'create' && message.type !== 'update' && message.type !== 'backfill') {
				debugVerbose('watchFeed listener ' + currentUser.username + ' received ' + message.type + ' but NewsFeedItem not found %j', myNewsFeedItem);
				return;
			}

			if (myNewsFeedItem.deleted) {
				debugVerbose('watchFeed listener ' + currentUser.username + ' received ' + message.type + ' marked as deleted but NewsFeedItem not found %j', myNewsFeedItem);
				return;
			}

			var about = myNewsFeedItem.about;
			var whoAbout = about.replace(/\/(post|photo)\/.*$/, '');
			var isMe = false;
			if (whoAbout === server.locals.config.publicHost + '/' + currentUser.username) {
				isMe = true;
			}

			var filter = {
				'where': {
					'or': [{
						'remoteEndPoint': whoAbout
					}]
				}
			};

			if (myNewsFeedItem.target) {
				filter.where.or.push({
					'remoteEndPoint': myNewsFeedItem.target
				});
			}

			server.models.Friend.find(filter, function (err, found) {
				if (err) {
					logger.error({
						err: err
					}, 'error finding friends');
					return;
				}

				if (!found.length && !isMe) {
					debugVerbose('watchFeed ' + currentUser.username + ' ' + server.locals.config.publicHost + '/' + currentUser.username + 'meh. not interested in stuff about ' + whoAbout);
					return;
				}

				async.waterfall([
						function doAddressChange(cb) {
							if (message.data.type !== 'address change') {
								return async.setImmediate(function () {
									cb();
								});
							}

							if (!message.data.details.newEndPoint) {
								console.log('huh? %j', message.data);
							}

							disConnect(server, friend);

							var parsed = url.parse(message.data.details.newEndPoint);

							friend.updateAttributes({
								'remoteEndPoint': message.data.details.newEndPoint,
								'remoteHost': parsed.protocol + '://' + parsed.host,
								'remoteUsername': parsed.pathname.substring(1)
							}, function (err, updated) {
								if (err) {
									logger.error({
										err: err
									}, 'error saving address change');

									watchFeed.connect(server, currentUser, friend);
									return cb(err);
								}
								cb();
							});
						},
						function createNewFeedItem(cb) {

							delete myNewsFeedItem.id;
							delete myNewsFeedItem.visibility;

							myNewsFeedItem.userId = currentUser.id;
							myNewsFeedItem.friendId = friend.id;

							debugVerbose('watchFeed ' + currentUser.username + ' create NewsFeedItem %j', myNewsFeedItem);

							server.models.NewsFeedItem.create(myNewsFeedItem, function (err, item) {
								if (err) {
									logger.error({
										'myNewsFeedItem': myNewsFeedItem
									}, 'error saving NewsFeedItem item');
									return cb(err);
								}
								cb();
							});
						},
						function notifyNetwork(cb) {
							// somebody posted to my wall
							if (!message.data.target || message.data.type !== 'post' || message.data.target !== server.locals.config.publicHost + '/' + currentUser.username) {
								return process.nextTick(function () {
									cb();
								});
							}

							async.waterfall([
								function (cbPostOnMyWall) { // make a Post record
									var post = {
										'uuid': message.data.uuid,
										'athoritativeEndpoint': message.data.about,
										'source': message.data.source,
										'userId': currentUser.id,
										'visibility': message.data.visibility
									};

									server.models.Post.create(post, function (err, post) {
										if (err) {
											var e = new VError(err, 'could create Post');
											return cbPostOnMyWall(e);
										}
										cbPostOnMyWall(null, post);
									});
								}
							], function (err) {
								cb(err);
							});
						},
						function updateHighwater(cb) {

							debugVerbose('watchFeed ' + currentUser.username + ' saving highwater %j', message.data.createdOn);

							friend.updateAttributes({
								'highWater': message.data.createdOn
							}, function (err, updated) {
								if (err) {
									logger.error({
										err: err
									}, 'error saving highwater');
									return cb(err);
								}
								cb();
							});
						},
						function getUserSettings(cb) {
							utils.getUserSettings(server, currentUser, function (err, settings) {
								cb(err, settings);
							});
						},
						function doEmailNotifications(settings, cb) {
							if (message.type === 'backfill') {
								return async.setImmediate(function () {
									return cb();
								});
							}
							if (!isMe && (message.data.type !== 'post' && message.data.type !== 'friend')) {
								return async.setImmediate(function () {
									return cb();
								});
							}
							var wantNotification = false;
							var template = '';
							var options = {
								'to': currentUser.email,
								'from': process.env.OUTBOUND_MAIL_SENDER,
								'config': server.locals.config,
								'item': message.data
							};

							if (message.data.type === 'friend' && settings.notifications_friend_request) {
								wantNotification = true;
								template = 'emails/notify-friend-accepted';
								options.subject = 'is now friends with';
							}
							else if (message.data.type === 'post' && settings.notifications_posts) {
								wantNotification = true;
								template = 'emails/notify-post-activity';
								options.subject = 'posted';
								options.endpoint = message.data.about;
							}
							else if (message.data.type === 'comment' && settings.notifications_comments) {
								wantNotification = true;
								template = 'emails/notify-post-activity';
								options.subject = 'commented';
								options.endpoint = message.data.about + '/comment/' + message.data.uuid;
							}
							else if (message.data.type === 'react' && settings.notifications_reactions) {
								wantNotification = true;
								template = 'emails/notify-post-activity';
								options.subject = 'reacted';
								options.endpoint = message.data.about;
								var reactions = {
									'thumbs-up': '👍🏼',
									'thumbs-down': '👎',
									'love': '❤️',
									'laugh': '😆',
									'smirk': '😏',
									'wow': '😮',
									'cry': '😢',
									'mad': '😡',
									'vomit': '🤮'
								};
								options.reactionDetails = reactions[message.data.details.reaction];
							}

							//console.log(wantNotification, options);

							if (!wantNotification) {
								return async.setImmediate(function () {
									return cb();
								});
							}

							var resolveProfile = require('./resolveProfile');

							async.waterfall([
								function (doneResolve) {
									resolveProfile(server, message.data.source, function (err, profile) {
										doneResolve(err, profile);
									});
								},
								function (profile, doneResolve) {
									var who = utils.whoAbout(message.data.about, null, true);
									resolveProfile(server, who, function (err, aboutProfile) {
										doneResolve(err, profile, aboutProfile);
									});
								},
								function (profile, aboutProfile, doneResolve) {
									if (message.data.type !== 'comment') {
										return doneResolve(err, profile, aboutProfile, null);
									}
									utils.getEndPointJSON(server, options.endpoint, currentUser, friend, {
										'json': 1
									}, function (err, data) {
										doneResolve(err, profile, aboutProfile, data);
									});
								},
								function (profile, aboutProfile, details, doneResolve) {
									var endpoint = options.endpoint;
									if (message.data.type === 'comment') {
										endpoint = details.comment.about;
									}
									if (!endpoint) {
										return doneResolve(null, profile, aboutProfile, details, null);
									}
									utils.getEndPointJSON(server, endpoint, currentUser, null, {
										'json': true,
										'postonly': true
									}, function (err, data) {
										if (err) {
											return doneResolve(err);
										}
										doneResolve(null, profile, aboutProfile, details, data);
									});
								}
							], function (err, profile, aboutProfile, details, post) {
								if (err) {
									var e = new VError(err, 'Error building notification email');
									console.log(e.message);
									console.log(e.stack);
									console.log(message);
									return cb();
								}
								options.profile = profile ? profile.profile : null;
								options.aboutProfile = aboutProfile ? aboutProfile.profile : null;
								options.comment = details ? details.comment : null;
								options.post = post ? post.post : null;
								options.ogMap = post ? post.ogMap : null;
								options.config = server.locals.config;
								options._ = require('lodash');
								options.marked = server.locals.marked;
								options.type = message.data.type;
								options.subject = options.profile.name + ' ' + options.subject + ' ';

								if (options.post) {
									if (message.data.type === 'comment' || message.data.type === 'react') {
										options.subject += 'on the post ';
									}
									options.subject += '"' + options.post.description + '"';
								}
								if (message.data.type === 'friend') {
									options.subject += options.aboutProfile.name;
								}

								mailer(server, template, options, function (err, info) {
									debugVerbose('mail status %j %j', err, info);
								});

								cb();
							});
						}
					],
					function (e) {
						if (e) {
							logger.error({
								err: e
							}, 'error processing newsfeed');
						}
						return;
					});
			});
		}
	});
};
