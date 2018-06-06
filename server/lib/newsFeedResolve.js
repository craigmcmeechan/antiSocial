var resolveProfiles = require('./resolveProfiles');
var server = require('../server');
var debug = require('debug')('resolve');
var debugVerbose = require('debug')('resolve:verbose');
var proxyEndPoint = require('./proxy-endpoint');
var utils = require('./utilities');

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
			debug(myNewsFeedItem.source + ' friend request ' + myNewsFeedItem.about);
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += 'Friend request from <a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'friend invite accepted') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += 'Friend invite accepted by <a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + sourceProfile.profile.name + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'friend') {
			debug(myNewsFeedItem.source + ' and ' + myNewsFeedItem.about + ' are now friends');
			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + utils.fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' is now friends with <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">' + utils.fixNameYou(myEndPoint, myNewsFeedItem.about, aboutProfile.profile.name) + '</a>';
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
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + utils.fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			var description = myNewsFeedItem.description || 'this';
			myNewsFeedItem.humanReadable += ' posted <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">' + description + '</a>';
			if (myNewsFeedItem.target) {
				myNewsFeedItem.humanReadable += ' on <a href="' + proxyEndPoint(myNewsFeedItem.target, currentUser) + '"> ' + utils.fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name, true) + '</a> wall';
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
			myNewsFeedItem.humanReadable += '<a href="' + proxyEndPoint(myNewsFeedItem.source, currentUser) + '">' + utils.fixNameYou(myEndPoint, myNewsFeedItem.source, sourceProfile.profile.name) + '</a>';
			myNewsFeedItem.humanReadable += ' tagged ';
			myNewsFeedItem.humanReadable += '  <a href="' + proxyEndPoint(myNewsFeedItem.target, currentUser) + '"> ' + utils.fixNameYou(myEndPoint, myNewsFeedItem.target, targetProfile.profile.name) + '</a> in ';
			var description = myNewsFeedItem.description || 'this post';
			myNewsFeedItem.humanReadable += ' <a href="' + proxyEndPoint(myNewsFeedItem.about, currentUser) + '">' + description + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.type === 'comment') {
			var about = myNewsFeedItem.about;
			about = about.replace(/\/(comment|photo)\/.*/, '');

			debug(sourceProfile.profile.name + '" commented on ' + myNewsFeedItem.about);

			myNewsFeedItem.humanReadable = '<img src="' + sourceProfile.profile.photo.url + '">';
			myNewsFeedItem.humanReadable += '<div>';
			myNewsFeedItem.humanReadable += myNewsFeedItem.summary;
			myNewsFeedItem.humanReadable += ' commented on <a href="' + proxyEndPoint(whoAbout, currentUser) + '">' + utils.fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name, true) + '</a>';
			var description = utils.kindOfThing(about);
			if (myNewsFeedItem.description) {
				description += ' about: ' + myNewsFeedItem.description;
			}
			myNewsFeedItem.humanReadable += ' <a href="' + proxyEndPoint(about, currentUser) + '">' + description + '</a>';
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
			myNewsFeedItem.humanReadable += ' reacted with <span class="em em-' + myNewsFeedItem.details.reaction + '"></span>';
			myNewsFeedItem.humanReadable += ' to <a href="' + proxyEndPoint(whoAbout, currentUser) + '">' + utils.fixNameYou(myEndPoint, whoAbout, aboutProfile.profile.name, true) + '</a>';
			var description = utils.kindOfThing(about);
			if (myNewsFeedItem.description) {
				description += ' about: ' + myNewsFeedItem.description;
			}
			myNewsFeedItem.humanReadable += ' <a href="' + proxyEndPoint(about, currentUser) + '">' + description + '</a>';
			myNewsFeedItem.humanReadable += '</div>';
		}

		if (myNewsFeedItem.humanReadable) {
			myNewsFeedItem.humanReadable = myNewsFeedItem.humanReadable.replace(/<a[^>]+>/g, '');
			myNewsFeedItem.humanReadable = myNewsFeedItem.humanReadable.replace(/<\/a>/g, '');
		}
		done(null, myNewsFeedItem);
	});
};
