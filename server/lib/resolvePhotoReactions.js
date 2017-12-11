var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolvePhotoReactions(post, photo, done) {

	var query = {
		'where': {
			'and': [{
				'about': post.source + '/post/' + post.uuid + '/photo/' + photo.uuid
			}, {
				'type': 'react'
			}]
		},
		'order': 'createdOn ASC'
	};

	console.log('query %j', query);

	server.models.NewsFeedItem.find(query, function (err, reactions) {
		if (err) {
			return done(err);
		}

		console.log('reactions %j', reactions);

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

		photo.resolvedReactions = reactions;

		done();
	});
};
