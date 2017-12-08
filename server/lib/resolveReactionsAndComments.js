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
					doneWaterfall(null, comments);
				});
			},
			function getReactions(comments, doneWaterfall) {
				var query = {
					'where': {
						'and': [{
							'about': postEndpoint
						}, {
							'type': 'new reaction'
						}]
					},
					'order': 'createdOn ASC'
				};

				server.models.NewsFeedItem.find(query, function (err, reactions) {
					if (err) {
						return doneWaterfall(err);
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
}
