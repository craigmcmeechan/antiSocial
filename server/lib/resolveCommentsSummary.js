// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');
var proxyEndPoint = require('./proxy-endpoint');


module.exports = function resolveCommentsSummary(item, done) {
	debug('resolveCommentsSummary ' + item.uuid);

	var comments = typeof item.resolvedComments === 'function' ? item.resolvedComments() : item.resolvedComments;

	if (comments && comments.length) {
		var hash = {};
		var mentions = [];
		for (var i = 0; i < comments.length; i++) {
			var comment = comments[i];
			if (!hash[comment.source]) {
				hash[comment.source] = true;
				var mention = '<a href="/proxy-profile?endpoint=' + encodeURIComponent(comment.source) + '">' + comment.resolvedProfiles[comment.source].profile.name + '</a>';
				mentions.push(mention);
			}
		}

		var summary = mentions.slice(0, 2).join(', ');

		if (mentions.length > 2) {
			var remainder = mentions.length - 2
			summary += ' and ' + remainder + ' other'
			if (remainder > 1) {
				summary += 's'
			}
		}

		item.commentSummary = summary;
	}

	done();
};
