var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolveCommentReactions(comments, done) {
	async.map(comments, function (comment, doneMap) {
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
				return doneMap(err);
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

			doneMap();
		});

	}, function (err) {
		done();
	});
};
