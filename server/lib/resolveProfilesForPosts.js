var async = require('async');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveCommentsSummary = require('../lib/resolveCommentsSummary');
var resolveReactionsSummary = require('../lib/resolveReactionsSummary');

function resolveProfilesForPost(post, done) {
	async.series([
		function (cb) {
			async.each([post], resolveProfiles, function (err) {
				cb(err);
			});
		},
		function (cb) {
			var comments = typeof post.resolvedComments === 'function' ? post.resolvedComments() : post.resolvedComments;
			async.each(comments, resolveProfiles, function (err) {
				cb(err);
			});
		},
		function (cb) {
			resolveCommentsSummary(post, function (err) {
				cb(err);
			});
		},
		function (cb) {
			var comments = typeof post.resolvedComments === 'function' ? post.resolvedComments() : post.resolvedComments;
			async.each(comments, function (comment, doneComment) {
				var reactions = typeof comment.resolvedReactions === 'function' ? comment.resolvedReactions() : comment.resolvedReactions;
				async.each(reactions, resolveProfiles, function (err) {
					doneComment(err);
				});
			}, function (err) {
				cb(err);
			});
		},
		function (cb) {
			var reactions = typeof post.resolvedReactions === 'function' ? post.resolvedReactions() : post.resolvedReactions;

			async.each(reactions, resolveProfiles, function (err) {
				cb(err);
			});
		},
		function (cb) {
			resolveReactionsSummary(post, function (err) {
				cb(err);
			});
		}
	], function (err) {
		done(err);
	});
}

function resolveProfilesForPosts(posts, done) {
	async.each(posts, resolveProfilesForPost, function (err) {
		done(err);
	});
}

module.exports = resolveProfilesForPosts;
