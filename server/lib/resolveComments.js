var server = require('../server');
var async = require('async');
var VError = require('verror').VError;
var WError = require('verror').WError;

var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');
var resolveReactions = require('./resolveReactions');

module.exports = function resolveComments(items, itemType, done) {
	async.map(items, function (item, doneMap) {

		var about = item.about ? item.about : item.source;

		var query = {
			'where': {
				'and': [{
					'about': about + '/' + itemType + '/' + item.uuid
				}, {
					'type': 'comment'
				}, {
					'originator': 'false'
				}]
			},
			'order': 'createdOn ASC'
		};

		//console.log('comments: "' + itemType + '" %j ', query);

		server.models.NewsFeedItem.find(query, function (err, comments) {
			if (err) {
				return doneMap(err);
			}

			item.resolvedComments = comments;

			resolveReactions(item.resolvedComments, 'comment', function (err) {
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
