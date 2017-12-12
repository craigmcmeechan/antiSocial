var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;
var resolveCommentReactions = require('./resolveCommentReactions');

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolvePhotoComments(post, photo, done) {

	var query = {
		'where': {
			'and': [{
				'about': post.source + '/post/' + post.uuid + '/photo/' + photo.uuid
			}, {
				'type': 'comment'
			}]
		},
		'order': 'createdOn ASC'
	};

	server.models.NewsFeedItem.find(query, function (err, comments) {
		if (err) {
			return done(err);
		}

		photo.resolvedComments = comments;

		resolveCommentReactions(photo.resolvedComments, function (err) {
			done();
		});
	});
};
