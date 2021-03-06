// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var resolveProfiles = require('../lib/resolveProfiles');
var proxyEndPoint = require('../lib/proxy-endpoint');
var getProfile = require('../lib/getProfile');

var VError = require('verror').VError;
var WError = require('verror').WError;
var async = require('async');
var request = require('request');
var _ = require('lodash');
var url = require('url');
var jsdom = require('jsdom');

var debug = require('debug')('scroll');
var debugVerbose = require('debug')('scroll:verbose');

var ITEMS_PER_PAGE = 4;
var ITEMS_PER_SELECT = 50;

module.exports = function (server) {
  var router = server.loopback.Router();
  var cache = server.locals.myCache;

  // my news feed
  router.get('/feed', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.getCurrentContext();
    var currentUser = ctx.get('currentUser');
    var userSettings = ctx.get('userSettings');
    var filters = _.get(req, 'cookies.filters') ? JSON.parse(req.cookies.filters) : {};

    var friendMap = {};
    friendMap[server.locals.config.publicHost + '/' + currentUser.username] = true;

    var audienceFilter = function (audience) {
      return filters.audiences.indexOf(audience) !== -1;
    };

    for (var i = 0; i < currentUser.friends().length; i++) {
      var f = currentUser.friends()[i];

      var inFilter = true;
      if (filters && filters.audiences && filters.audiences.length) {
        if (!f.audiences.filter(audienceFilter).length) {
          inFilter = false;
        }
      }

      if (inFilter) {
        friendMap[f.remoteEndPoint] = f;
      }
    }

    async.waterfall([
      function getScrollSession(cb) {
        var session = cache.get('scrollSession-' + currentUser.id.toString());
        // new session
        if (!req.query.more || !session) {
          session = {
            'uniqueAbout': {},
            'queue': [],
            'feedHighwater': '',
            'currentSlice': {
              'start': 0,
              'end': 0
            },
            'filters': _.get(req, 'cookies.filters')
          };
          debug('new scroll session');
        }
        cb(null, session);
      },
      function getMoreItems(session, cb) {
        if (session.atEnd) {
          return cb(null, session);
        }

        var query = {
          'where': {
            'and': [{
              'userId': currentUser.id
            }, {
              'deleted': {
                'neq': true
              }
            }]
          },
          'order': 'createdOn DESC',
          'limit': ITEMS_PER_SELECT
        };

        if (session.feedHighwater) {
          query.where.and.push({
            'createdOn': {
              'lt': session.feedHighwater
            }
          });
        }

        if (userSettings.feedSortOrder === 'post') {
          query.where.and.push({
            'type': 'post'
          });
        }

        if (req.query.tags) {
          var tags;
          try {
            tags = JSON.parse(req.query.tags);
          }
          catch (e) {
            tags = [];
          }
          query.where.and.push({
            'tags': {
              'inq': tags
            }
          });
        }

        debug('get more items %j', query);

        server.models.NewsFeedItem.find(query, function (err, items) {
          if (err) {
            var e = new VError(err, 'error reading NewsFeedItems');
            cb(e);
          }

          async.mapSeries(items, resolveProfiles, function (err) {

            if (items && items.length) {
              session.feedHighwater = items[items.length - 1].createdOn;
              debug('got items', items.length, session.feedHighwater, items[items.length - 1].uuid);
            }
            else {
              debug('at end');
              session.atEnd = true;
              return cb(null, session);
            }

            var map = {};
            var grouped = {};

            // group news feed items by 'about'
            for (var i = 0; i < items.length; i++) {
              if (items[i].type === 'post' || items[i].type === 'comment' || items[i].type === 'react') {
                var key = items[i].about;
                key = key.replace(/\/(comment|photo)\/.*/, '');
                var whoAbout = key.replace(/\/post\/.*/, '');
                if (friendMap[whoAbout]) {
                  if (!map[key]) {
                    map[key] = 0;
                    grouped[key] = [];
                  }
                  ++map[key];
                  grouped[key].push(items[i]);
                }
              }
            }

            // add new item groups to scroll queue
            for (var key in grouped) {
              var group = grouped[key];
              if (!session.uniqueAbout[key]) { // ignore item if already shown in this session
                session.uniqueAbout[key] = true;
                session.queue.push(group);
                debug('pushing queue %s', key);
              }
              else {
                debug('dupe %s', key);
              }
            }

            cb(null, session);
          });

        });
      },
      function computeSummary(session, cb) {
        if (req.query.more) {
          session.currentSlice.start += ITEMS_PER_PAGE;
          if (session.currentSlice.start > session.queue.length - 1) {
            return cb(null, session, []);
          }
        }

        session.currentSlice.end = session.currentSlice.start + (ITEMS_PER_PAGE - 1);
        if (session.currentSlice.end > session.queue.length - 1) {
          session.currentSlice.end = session.queue.length - 1;
        }

        debug('queue.length:', session.queue.length);
        debug('currentSlice', session.currentSlice);

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
                var mention = '<a href="' + proxyEndPoint(groupItem.source, currentUser) + '">' + groupItem.resolvedProfiles[groupItem.source].profile.name + '</a>';
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
        debug('save scroll session');
        cache.set('scrollSession-' + currentUser.id.toString(), session, 3600, function (err) {
          cb(err, items);
        });
      },
      function resolvePosts(items, cb) {
        async.map(items, function (item, doneResolve) {
          var post = item.about;
          post = post.replace(/\/(comment|photo)\/.*/, '');
          var endpoint = proxyEndPoint(post, ctx.get('currentUser'), {
            'embed': true
          });
          var proxyHost = res.app.locals.config.publicHost;

          if (process.env.BEHIND_PROXY === "true") {
            var rx = new RegExp('^' + server.locals.config.publicHost);
            if (proxyHost.match(rx)) {
              proxyHost = proxyHost.replace(server.locals.config.publicHost, 'http://localhost:' + server.locals.config.port);
              debug('bypass proxy ' + proxyHost);
            }
          }

          request.get({
            'url': proxyHost + endpoint,
            'headers': {
              'access_token': req.signedCookies.access_token
            }
          }, function (err, response, body) {
            if (err) {
              item.httpStatus = 500;
              item.html = '<div class="post">Content unavailable. (' + err + ')</div>';
              return doneResolve();
            }

            item.httpStatus = response.statusCode;

            if (response.statusCode !== 200) {
              item.html = '<div class="post">Content unavailable. (' + response.statusCode + ')</div>';
              return doneResolve();
            }

            var dom = new jsdom.JSDOM(body);
            var element = dom.window.document.querySelector('.post');
            item.html = element ? element.outerHTML : '<div class="post">Content unavailable.</div>';

            doneResolve();
          })
        }, function (err) {
          cb(err, items);
        });
      }
    ], function (err, items) {
      //res.send(items);

      res.render('pages/feed', {
        'user': ctx.get('currentUser'),
        'globalSettings': ctx.get('globalSettings'),
        'userSettings': ctx.get('userSettings'),
        'items': items,
        'more': req.query.more,
        'profile': getProfile(currentUser),
        'pageTitle': 'Feed',
        'filters': filters
      });

    });
  });

  server.use(router);
};
