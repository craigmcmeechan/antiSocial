var server = require('../server');
var async = require('async');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

module.exports = function resolveReactionsAndComments(posts, done) {
	async.map(posts, function (post, doneMap) {
		var postEndpoint = post.source + '/post/' + post.uuid;
		async.waterfall([
			function getComments(doneWaterfall) {
				var query = {
					'where': {
						'and': [{
							'about': postEndpoint
						}, {
							'type': 'new comment'
						}]
					},
					'order': 'createdOn ASC'
				};

				server.models.NewsFeedItem.find(query, function (err, comments) {
					if (err) {
						return doneWaterfall(err);
					}

					//--- get reactions to comments ---

					async.map(comments, function (comment, doneCommentReactions) {
						var query = {
							'where': {
								'and': [{
									'about': comment.about + '/comment/' + comment.uuid
								}, {
									'type': 'react'
								}]
							},
							'order': 'createdOn ASC'
						};

						server.models.NewsFeedItem.find(query, function (err, reactions) {
							if (err) {
								return doneCommentReactions(err);
							}

							var hash = {};
							var uniqued = [];
							if (reactions) {
								for (var i = 0; i < reactions.length; i++) {
									if (!hash[reactions[i].source]) {
										hash[reactions[i].source] = true;
										uniqued.push(reactions[i]);
									}
								}
								reactions = uniqued;
							}

							comment.resolvedReactions = reactions;

							doneCommentReactions();
						});
					}, function (err) {
						doneWaterfall(null, comments);
					});

					//---

				});
			},
			function getReactions(comments, doneWaterfall) {
				var query = {
					'where': {
						'and': [{
							'about': postEndpoint
						}, {
							'type': 'react'
						}]
					},
					'order': 'createdOn ASC'
				};

				server.models.NewsFeedItem.find(query, function (err, reactions) {
					if (err) {
						return doneWaterfall(err);
					}

					var hash = {};
					var uniqued = [];
					if (reactions) {
						for (var i = 0; i < reactions.length; i++) {
							if (!hash[reactions[i].source]) {
								hash[reactions[i].source] = true;
								uniqued.push(reactions[i]);
							}
						}
						reactions = uniqued;
					}

					doneWaterfall(null, comments, reactions);
				});
			}
		], function (err, comments, reactions) {
			if (err) {
				return doneMap(err);
			}
			post.resolvedComments = comments;
			post.resolvedReactions = reactions;
			doneMap(null);
		})
	}, function (err) {
		if (err) {
			return err;
		}
		resolveProfilesForPosts(posts, function (err) {
			if (err) {
				return done(err);
			}
			done();
		});
	});
};
