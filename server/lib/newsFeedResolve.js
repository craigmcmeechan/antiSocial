var resolveProfiles = require('./resolveProfiles');
var server = require('../server');
var debug = require('debug')('feeds');
var debugVerbose = require('debug')('feeds:verbose');

module.exports = function newsFeedItemResolve(currentUser, myNewsFeedItem, done) {
	resolveProfiles(myNewsFeedItem, function (err) {
		var myEndPoint = server.locals.config.publicHost + '/' + currentUser.username;

		var sourceProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.source];
		var aboutProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.about];

		var targetProfile;
		if (myNewsFeedItem.target) {
			targetProfile = myNewsFeedItem.resolvedProfiles[myNewsFeedItem.target];
		}

		var whoAbout = myNewsFeedItem.about.replace(/\/post\/.*$/, '');

		if (myNewsFeedItem.type === 'friend') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');

			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' added <a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.about, aboutProfile.profile.name) + '</a>';
		}

		if (myNewsFeedItem.type === 'post') {
			if (myNewsFeedItem.target === myEndPoint) {
				debug(sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about + ' to your wall');
			}
			else {
				debug(sourceProfile.profile.name + '" posted ' + myNewsFeedItem.about);
			}
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<a href="/proxy-profile?endpoint=' + encodeURIComponent(myNewsFeedItem.source) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' posted <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this</a>';
			if (myNewsFeedItem.target) {
				myNewsFeedItem.humanReadable += ' on <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.target) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name, true) + '</a> wall';
			}
		}

		if (myNewsFeedItem.type === 'comment') {
			debug(sourceProfile.profile.name + '" commented on ' + myNewsFeedItem.about);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' on <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="/proxy-post?endpoint=' + encodeURIComponent(whoAbout) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
		}

		if (myNewsFeedItem.type === 'react') {
			debug(sourceProfile.profile.name + '" reacted to ' + myNewsFeedItem.about);
			var reaction = '<span class="em em-' + myNewsFeedItem.details.reaction + '"></span>';
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' reacted to <a href="/proxy-post?endpoint=' + encodeURIComponent(myNewsFeedItem.about) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="/proxy-post?endpoint=' + encodeURIComponent(whoAbout) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
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
