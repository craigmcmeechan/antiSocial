var map = {};
var grouped = {};

// group news feed items by 'about' and 'type'
for (var i = 0; i < items.length; i++) {
	var key = items[i].about + ':' + items[i].type;
	if (!map[key]) {
		map[key] = 0;
		grouped[key] = [];
	}
	++map[key];
	grouped[key].push(items[i]);
}

var newsFeedItems = []

for (var i = 0; i < groups.length; i++) {
	var group = groups[i];

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
				var mention = '<a href="/proxy-profile?endoint=' + encodeURIComponent(groupItem.source) + '">' + groupItem.resolvedProfiles[groupItem.source].profile.name + '</a>';
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
		if (theItem.type === 'comment') {
			theItem.summary += ' commented';
		}
		if (theItem.type === 'react') {
			theItem.summary += ' reacted';
		}
	}

	newsFeedItems.push(theItem);
}
