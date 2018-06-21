// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var server = require('../server');
var async = require('async');

var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

var resolveReactions = require('./resolveReactions');

module.exports = function resolveComments(items, itemType, isMe, done) {
	async.map(items, function (item, doneMap) {
		debug('resolveComments ' + itemType + ' ' + item.uuid);

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

		if (!isMe) {
			query.where.and.push({
				'deleted': {
					'neq': true
				}
			});
		}

		//console.log('comments: "' + itemType + '" %j ', query);

		server.models.NewsFeedItem.find(query, function (err, comments) {
			if (err) {
				return doneMap(err);
			}

			var threads = [];
			for (var i = 0; i < comments.length; i++) {
				var comment = comments[i];
				if (!comment.details.replyTo) {
					var key = comment.about + '/comment/' + comment.uuid;
					threads[key] = [comment];
				}
				else {
					var key = comment.details.replyTo;
					threads[key].push(comment);
				}
			}

			var threaded = [];
			for (var i = 0; i < comments.length; i++) {
				var comment = comments[i];
				if (!comment.details.replyTo) {
					var key = comment.about + '/comment/' + comment.uuid;
					threaded = threaded.concat(threads[key]);
				}
			}

			item.resolvedComments = threaded;
			item.commentCount = comments.length;

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
