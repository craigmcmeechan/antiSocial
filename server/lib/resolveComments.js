var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var resolveCommentReactions = require('./resolveCommentReactions');

module.exports = function resolveReactionsCommentsAndProfiles(posts, done) {
	async.map(posts, function (post, doneMap) {

		var query = {
			'where': {
				'and': [{
					'about': post.source + '/post/' + post.uuid
				}, {
					'type': 'comment'
				}]
			},
			'order': 'createdOn ASC'
		};

		server.models.NewsFeedItem.find(query, function (err, comments) {
			if (err) {
				return doneMap(err);
			}

			post.resolvedComments = comments;

			resolveCommentReactions(post.resolvedComments, function (err) {
				doneMap();
			});

		})
	}, function (err) {
		if (err) {
			return done(err);
		}
		done();
	});
};
