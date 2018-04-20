var url = require('url');
var proxyEndPoint = require('../../server/lib/proxy-endpoint');

module.exports = function optimizeNewsFeedItems(items, myEndpoint, user) {

	var map = {};
	var grouped = {};

	// group news feed items by 'about' and 'type'
	for (var i = 0; i < items.length; i++) {
		var about = items[i].about;
		about = about.replace(/\/comment.*$/, '');
		var key = about + ':' + items[i].type;
		if (!map[key]) {
			map[key] = 0;
			grouped[key] = [];
		}
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
				if (!hash[groupItem.source]) {
					hash[groupItem.source] = true;
					var mention = '<a href="' + proxyEndPoint(groupItem.source, user) + '">' + fixNameYou(groupItem.source, myEndpoint, groupItem.resolvedProfiles[groupItem.source].profile.name) + '</a>';
					mentions.push(mention);
				}
			}
		}

		if (mentions.length) {
			var summary = mentions.slice(0, 3).join(', ');

			if (mentions.length > 2) {
				var remainder = mentions.length - 2;
				summary += ' and ' + remainder + ' other';
				if (mentions.length > 2) {
					summary += 's';
				}
			}

			theItem.summary = summary;
		}

		newsFeedItems.push(theItem);
	}

	return newsFeedItems;
};

function fixNameYou(endpoint, myEndpoint, name) {
	if (endpoint === myEndpoint) {
		return 'you';
	}
	return name;
}
