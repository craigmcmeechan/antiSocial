var server = require('../server');
var async = require('async');

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

var resolveReactions = require('./resolveReactions');

module.exports = function resolveComments(items, itemType, done) {
	debug('resolveComments');
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
					'type': 'comment'
				}, {
					'userId': item.userId
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
