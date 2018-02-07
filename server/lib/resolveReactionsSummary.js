var async = require('async');
var _ = require('lodash');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');
var proxyEndPoint = require('./proxy-endpoint');

module.exports = function resolveReactionsSummary(item, done) {
	debug('resolveReactionsSummary ' + item.uuid);
	var reactions = typeof item.resolvedReactions === 'function' ? item.resolvedReactions() : item.resolvedReactions;

	if (reactions && reactions.length) {
		var hash = {};
		var mentions = [];
		var icons = {};

		for (var i = 0; i < reactions.length; i++) {
			var reaction = reactions[i];
			var key = '<div class="reaction-button-summary reaction-button"><span class="em em-' + reaction.details.reaction + '"></div>';

			if (!hash[reaction.source]) {
				hash[reaction.source] = true;

				if (reaction.details.reaction) {
					if (!icons[key]) {
						icons[key] = 0;
					}
					icons[key]++;

					var name = _.get(reaction, 'resolvedProfiles["' + reaction.source + '"].profile.name');
					if (!name) {
						name = reaction.source;
					}
					var mention = '<a href="' + reaction.source + '">' + name + '</a>';

					mentions.push(mention);
				}
			}
		}

		var summary = mentions.slice(0, 3).join(', ');

		if (mentions.length > 2) {
			var remainder = mentions.length - 2;
			summary += ' and ' + remainder + ' other';
			if (mentions.length > 2) {
				summary += 's';
			}
		}

		var iconlist = '';
		for (var icon in icons) {
			iconlist += icon;
		}

		if (summary) {
			item.reactionSummary = {
				'summary': summary,
				'icons': iconlist
			};
		}
	}

	done();
};
