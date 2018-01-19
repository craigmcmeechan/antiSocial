var resolveProfiles = require('./resolveProfiles');
var server = require('../server');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');

module.exports = function newsFeedItemResolve(currentUser, myNewsFeedItem, done) {
	debug('newsFeedItemResolve');
	resolveProfiles(myNewsFeedItem, function (err) {
		var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;

		var sourceProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.source];
		var aboutProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.about];

		var targetProfile;
		if (myNewsFeedItem.target) {
			targetProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.target];
		}

		var whoAbout = myNewsFeedItem.about.replace(/\/post\/.*$/, '');

		if (myNewsFeedItem.type === 'pending friend request') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += 'Pending friend request from <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'friend') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');

			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' is now friends with <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.about, aboutProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'post') {
			if (myNewsFeedItem.target === myEndPoint) {
				debug(sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about + ' to your wall');
			}
			else {
				debug(sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about);
			}
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' posted <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this</a>';
			if (myNewsFeedItem.target) {
				myNewsFeedItem.humanReadable += ' on <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.target) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name, true) + '</a> wall';
			}
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'tag') {
			if (myNewsFeedItem.target === myEndPoint) {
				debug(sourceProfile.profile.name + '" tagged me in ' + myNewsFeedItem.about);
			}
			else {
				debug(sourceProfile.profile.name + '" tagged ' + myNewsFeedItem.target + ' in ' + myNewsFeedItem.about);
			}
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' tagged ';
			myNewsFeedItem.humanReadable += '  <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.target) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name) + '</a> in ';
			myNewsFeedItem.humanReadable += ' <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this post</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'comment') {
			var about = myNewsFeedItem.about;
			about = about.replace(/\/(comment|photo)\/.*/, '');

			debug(sourceProfile.profile.name + '" commented on ' + myNewsFeedItem.about);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' on <a href="/proxy-post?endpoint=' + encodeURIComponent(about) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="/proxy-profile?endpoint=' + encodeURIComponent(whoAbout) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'react') {
			var about = myNewsFeedItem.about;
			about = about.replace(/\/(comment|photo)\/.*/, '');

			debug(sourceProfile.profile.name + '" reacted to ' + myNewsFeedItem.about);
			var reaction = '<span class="em em-' + myNewsFeedItem.details.reaction + '"></span>';
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' reacted to <a href="/proxy-post?endpoint=' + encodeURIComponent(about) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="/proxy-profile?endpoint=' + encodeURIComponent(whoAbout) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		done(null, myNewsFeedItem);
	});

	function fixNameYou(endpoint, myendpoint, name, your) {
		if (endpoint === myendpoint) {
			if (your) {
				return 'your'
			};
			return 'you';
		}
		return name;
	}
};
