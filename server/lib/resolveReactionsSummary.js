var async = require('async');

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
				var mention = '<a href="/profile?endoint=' + encodeURIComponent(reaction.source) + '">' + reaction.resolvedProfiles[reaction.source].profile.name + '</a>';
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
