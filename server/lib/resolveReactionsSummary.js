// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
			if (reaction.details.reaction) {
				var key = '<div class="reaction-button-container reaction-button"><span class="em em-' + reaction.details.reaction + '"></span></div>';

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

						name = name.replace(/ .*/, '');

						var mention = '<a href="/proxy-profile?endpoint=' + encodeURIComponent(reaction.source) + '">' + name + '</a>';

						mentions.push(mention);
					}
				}
			}
		}

		var summary = mentions.slice(0, 2).join(', ');

		if (mentions.length > 2) {
			var remainder = mentions.length - 2;
			summary += ' and ' + remainder + ' other';
			if (remainder > 1) {
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
