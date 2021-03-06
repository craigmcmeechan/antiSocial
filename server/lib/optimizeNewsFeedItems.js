// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var url = require('url');
var proxyEndPoint = require('./proxy-endpoint');
var utils = require('./utilities');

module.exports = function optimizeNewsFeedItems(items, myEndpoint, user, wantBySource) {

	var map = {};
	var grouped = {};
	var bySource = {};

	// group news feed items by 'about' and 'type'
	for (var i = 0; i < items.length; i++) {
		var about = items[i].about;
		about = about.replace(/\/comment.*$/, '');
		about = about.replace(/\/photo.*$/, '');
		var key = about + ':' + items[i].type;
		if (!map[key]) {
			map[key] = 0;
			grouped[key] = [];
		}

		if (!bySource[items[i].source]) {
			bySource[items[i].source] = {
				items: []
			};
		}
		bySource[items[i].source].items.push(items[i]);

		++map[key];
		grouped[key].push(items[i]);
	}

	var newsFeedItems = [];

	for (var groupAbout in grouped) {
		var group = grouped[groupAbout];

		var about = group[0].about;
		var endpoint = url.parse(group[0].about).pathname;

		var hash = {};
		var mentions = [];
		var theItem = group[0];

		for (var j = 0; j < group.length; j++) {
			var groupItem = group[j];
			if (groupItem.type === 'comment' || groupItem.type === 'react') {
				var mention = '<a href="' + proxyEndPoint(groupItem.source, user) + '">' + utils.fixNameYou(groupItem.source, myEndpoint, groupItem.resolvedProfiles[groupItem.source].profile.name) + '</a>';
				groupItem.mention = mention;

				if (!hash[groupItem.source]) {
					hash[groupItem.source] = true;
					mentions.push(mention);
				}
			}
		}

		if (mentions.length) {
			var summary = mentions.slice(0, 2).join(', ');

			if (mentions.length > 2) {
				var remainder = mentions.length - 2;
				summary += ' and ' + remainder + ' other';
				if (remainder > 1) {
					summary += 's';
				}
			}

			theItem.summary = summary;
		}

		newsFeedItems.push(theItem);
	}

	if (wantBySource) {
		for (var source in bySource) {
			bySource[source].counts = {};
			bySource[source].items = bySource[source].items.reverse()
			for (var i = 0; i < bySource[source].items.length; i++) {
				var item = bySource[source].items[i];
				if (!bySource[source].counts[item.type]) {
					bySource[source].counts[item.type] = 0;
				}
				++bySource[source].counts[item.type];
			}
		}
		return bySource;
	}

	return newsFeedItems;
};
