var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function resolveReactions(items, itemType, done) {
	async.map(items, function (item, doneMap) {

		var about = item.about ? item.about : item.source;

		if (item.constructor.definition.name === 'Post') { // TODO kludge
			about = item.source;
		}

		var query = {
			'where': {
				'and': [{
					'about': about + '/' + itemType + '/' + item.uuid
				}, {
					'type': 'react'
				}, {
					'userId': item.userId
				}]
			},
			'order': 'createdOn DESC'
		};

		server.models.NewsFeedItem.find(query, function (err, reactions) {
			if (err) {
				return doneMap(err);
			}

			var hash = {};
			var uniqued = [];
			if (reactions && reactions.length) {
				for (var i = 0; i < reactions.length; i++) {
					if (!hash[reactions[i].source]) {
						hash[reactions[i].source] = true;
						uniqued.push(reactions[i]);
					}
				}
				reactions = uniqued;
			}

			item.resolvedReactions = reactions;

			doneMap();
		});
	}, function (err) {
		done();
	});
};
