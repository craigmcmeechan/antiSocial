var async = require('async');
var _ = require('lodash');

module.exports = function resolveReactionsSummary(item, done) {
	var reactions = typeof item.resolvedReactions === 'function' ? item.resolvedReactions() : item.resolvedReactions;

	if (reactions && reactions.length) {
		var hash = {};
		var mentions = [];
		var icons = {};

		for (var i = 0; i < reactions.length; i++) {
			var reaction = reactions[i];
			var key = '<div class="reaction-button-summary"><span class="em em-' + reaction.details.reaction + '"></div>';

			if (!hash[reaction.source]) {
				hash[reaction.source] = true;
				if (!icons[key]) {
					icons[key] = 0;
				}
				icons[key]++;

				var name = _.get(reaction, 'resolvedProfiles["' + reaction.source + '"].profile.name');
				if (!name) {
					name = reaction.source;
				}
				var mention = '<a href="/proxy-profile?endpoint=' + encodeURIComponent(reaction.source) + '">' + name + '</a>';
				mentions.push(mention);
			}
		}

		var summary = mentions.slice(0, 3).join(', ');

		if (mentions.length > 2) {
			var remainder = mentions.length - 2
			summary += ' and ' + remainder + ' other'
			if (mentions.length > 2) {
				summary += 's'
			}
		}

		var iconlist = '';
		for (var icon in icons) {
			iconlist += icon;
		}

		item.reactionSummary = {
			'summary': summary,
			'icons': iconlist
		}

	}

	done();
};
