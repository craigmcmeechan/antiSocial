// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var publicUsers = require('../middleware/context-publicUsers');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var resolvePostPhotos = require('../lib/resolvePostPhotos');

var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('lodash');
var multer = require('multer');
var path = require('path');
var pug = require('pug');

var debug = require('debug')('communities');
var debugVerbose = require('debug')('communities:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();

  // List communities if more than one, redirect to comminity if only one
  router.get('/communities', getCurrentUser(), function (req, res, next) {
    var ctx = req.myContext;

    server.models.Community.find({}, function (err, communities) {
      if (err) {
        next(err);
      }

      if (!communities) {
        return res.sendStatus(404);
      }

      if (communities.length === 1) {
        return res.redirect('/community/' + communities[0].nickname);
      }

      res.render('pages/communities', {
        'user': ctx.get('currentUser'),
        'globalSettings': ctx.get('globalSettings'),
        'communities': communities,
        'pageTitle': 'Communities'
      });
    });
  });

  var communityRE = /^\/community\/([a-zA-Z0-9-]+)(\.json)?$/;

  router.get(communityRE, getCurrentUser(), function (req, res, next) {
    var ctx = req.myContext;
    var matches = req.url.match(communityRE);
    var community = matches[1];
    var view = matches[2];
    server.models.Community.findOne({
      'where': {
        'nickname': community
      }
    }, function (err, community) {
      if (err) {
        return next(err);
      }
      if (!community) {
        return res.sendStatus(404);
      }

      var query = {
        'where': {
          'and': [{
            'visibility': {
              'inq': ['community:' + community.nickname]
            },
            'posted': true
          }]
        },
        'order': 'createdOn DESC',
        'limit': 30,
        'include': [{
          'user': ['uploads']
        }, {
          'photos': ['uploads']
        }]
      };

      var highwater = 30;

      if (req.query.more) {
        if (!req.query.highwater) {
          query.skip = 30; // first load more invocation
        }
        else {
          query.skip = req.query.highwater;
        }
      }

      highwater += 30;

      req.app.models.Post.find(query, function (err, posts) {
        if (err) {
          return next(err);
        }

        resolveProfilesForPosts(posts, function (err) {
          resolvePostPhotos(posts, function (err) {
            res.header('x-highwater', highwater);
            res.render('pages/community', {
              'user': ctx.get('currentUser'),
              'globalSettings': ctx.get('globalSettings'),
              'data': {
                'posts': posts
              },
              'community': community,
              'pageTitle': 'Community: ' + community.name
            });
          });
        });
      });
    });
  });

  server.use(router);
};
