var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var resolveProfiles = require('../lib/resolveProfiles');

var cache = require('../lib/cache');
var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');
var url = require('url');

var debug = require('debug')('feed');
var debugVerbose = require('debug')('feed:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // my news feed
  router.get('/feed', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.getCurrentContext();
    var currentUser = ctx.get('currentUser');

    async.waterfall([
      function getScrollSession(cb) {
        var session = cache.get('scrollSession', currentUser.id.toString());
        // new session
        if (!req.query.more || !session) {
          session = {
            'uniqueAbout': {},
            'queue': [],
            'feedHighwater': '',
            'currentSlice': {
              'start': 0,
              'end': 0
            }
          };
        }
        cb(null, session);
      },
      function getMoreItems(session, cb) {
        var query = {
          'where': {
            'and': [{
              'userId': currentUser.id

            }]
          },
          'order': 'createdOn DESC',
          'limit': 100
        };

        if (session.feedHighwater) {
          query.where.and.push({
            'createdOn': {
              'gt': session.feedHighwater
            }
          });
        }

        server.models.NewsFeedItem.find(query, function (err, items) {
          if (err) {
            var e = new VError(err, 'error reading NewsFeedItems');
            cb(err);
          }

          async.map(items, resolveProfiles, function (err) {

            if (items && items.length) {
              session.feedHighwater = items[items.length - 1].createdOn;
            }
            else {
              session.atEnd = true;
              return cb(null, session);
            }

            var map = {};
            var grouped = {};

            // group news feed items by 'about'
            for (var i = 0; i < items.length; i++) {
              var key = items[i].about;
              if (!map[key]) {
                map[key] = 0;
                grouped[key] = [];
              }
              ++map[key];
              grouped[key].push(items[i]);
            }

            // add new item groups to scroll queue
            for (var key in grouped) {
              var group = grouped[key];
              if (!session.uniqueAbout[key]) { // ignore item if already shown in this session
                session.uniqueAbout[key] = true;
                session.queue.push(group);
              }
            }

            cb(null, session);
          });

        });
      },
      function computeSummary(session, cb) {
        if (req.query.more) {
          session.currentSlice.start += 30;
          if (session.currentSlice.start > session.queue.length - 1) {
            session.currentSlice.start = session.queue.length - 1;
          }
        }
        session.currentSlice.end = session.currentSlice.start + 30;
        if (session.currentSlice.end > session.queue.length - 1) {
          session.currentSlice.end = session.queue.length - 1;
        }

        var items = [];

        var groups = session.queue.slice(session.currentSlice.start, session.currentSlice.end + 1);
        for (var i = 0; i < groups.length; i++) {
          var group = groups[i];

          var about = group[0].about;
          var endpoint = url.parse(group[0].about).pathname;
          var psuedoType;

          var profileRE = /^\/([a-zA-Z0-9\-]+)$/;
          var postRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)$/;
          var postCommentRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)$/;
          var postPhotoRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)$/;
          var postPhotoCommentRE = /^\/([a-zA-Z0-9\-]+)\/post\/([a-f0-9\-]+)\/photo\/([a-f0-9\-]+)\/comment\/([a-f0-9\-]+)$/;

          if (endpoint.match(profileRE)) {
            psuedoType = 'profile';
          }

          if (endpoint.match(postRE)) {
            psuedoType = 'post';
          }

          if (endpoint.match(postCommentRE)) {
            psuedoType = 'post comment';
          }

          if (endpoint.match(postPhotoRE)) {
            psuedoType = 'photo';
          }

          if (endpoint.match(postPhotoCommentRE)) {
            psuedoType = 'photo comment';
          }

          var item = {
            'about': about,
            'psuedoType': psuedoType
          };

          var hash = {};
          var mentions = [];
          for (var j = 0; j < group.length; j++) {
            var groupItem = group[j];
            if (groupItem.type === 'comment' || groupItem.type === 'react') {
              if (!hash[groupItem.source]) {
                hash[groupItem.source] = true;
                var mention = '<a href="/proxy-profile?endpoint=' + encodeURIComponent(groupItem.source) + '">' + groupItem.resolvedProfiles[groupItem.source].profile.name + '</a>';
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
            item.type = 'interaction';
            item.feedSummary = summary + ' reacted to this (' + item.psuedoType + ')';
          }
          else { // not reactions or comments... probably 'friend' or 'post'
            item.type = group[0].type;
            item.feedSummary = item.type;
          }

          items.push(item);
        }

        cb(null, session, items);

      },
      function saveScrollSession(session, items, cb) {
        cache.put('scrollSession', currentUser.id.toString(), session, function (err) {
          cb(err, items);
        });
      }
    ], function (err, items) {
      //res.send(items);

      res.render('pages/feed', {
        'user': ctx.get('currentUser'),
        'globalSettings': ctx.get('globalSettings'),
        'items': items
      });

    });
  });

  server.use(router);
};
