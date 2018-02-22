var resolveProfiles = require('./resolveProfiles');
var server = require('../server');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');
var proxyEndPoint = require('./proxy-endpoint');

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

		if (myNewsFeedItem.type === 'pending friend request' || myNewsFeedItem.type === 'frend invite accepted') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += 'Friend request from <a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'friend') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');

			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' is now friends with <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.about, aboutProfile.profile.name) + '</a>';
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
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' posted <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">this</a>';
			if (myNewsFeedItem.target) {
				myNewsFeedItem.humanReadable += ' on <a href="' + proxyEndPoint(myNewsFeedItem.target, currentUser) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name, true) + '</a> wall';
			}
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'post edit') {
			if (myNewsFeedItem.target === myEndPoint) {
				debug(sourceProfile.profile.name + '" edited ' + myNewsFeedItem.about + ' to your wall');
			}
			else {
				debug(sourceProfile.profile.name + '" edited ' + myNewsFeedItem.about);
			}
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' edited <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">this</a>';
			if (myNewsFeedItem.target) {
				myNewsFeedItem.humanReadable += ' on <a href="' + proxyEndPoint(myNewsFeedItem.target, currentUser) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name, true) + '</a> wall';
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
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' tagged ';
			myNewsFeedItem.humanReadable += '  <a href="' + proxyEndPoint(myNewsFeedItem.target, currentUser) + '"> ' + fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name) + '</a> in ';
			myNewsFeedItem.humanReadable += ' <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">this post</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'comment') {
			var about = myNewsFeedItem.about;
			about = about.replace(/\/(comment|photo)\/.*/, '');

			debug(sourceProfile.profile.name + '" commented on ' + myNewsFeedItem.about);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' on <a href="' + proxyEndPoint(about, currentUser) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="' + proxyEndPoint(whoAbout, currentUser) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
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
			myNewsFeedItem.humanReadable += ' reacted to <a href="' + proxyEndPoint(about, currentUser) + '">this post</a>';
			myNewsFeedItem.humanReadable += ' by <a href="' + proxyEndPoint(whoAbout, currentUser) + '">' + fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name) + '</a>';
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
