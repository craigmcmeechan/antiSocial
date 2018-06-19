// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var isInitialized = require('../middleware/context-initialized');
var publicUsers = require('../middleware/context-publicUsers');
var resolveProfiles = require('../lib/resolveProfiles');
var resolveProfilesForPosts = require('../lib/resolveProfilesForPosts');
var resolvePostPhotos = require('../lib/resolvePostPhotos');

var url = require('url');
var async = require('async');
var request = require('request');
var _ = require('lodash');
var multer = require('multer');
var path = require('path');
var pug = require('pug');


var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();


  // public feed
  router.get('/', isInitialized(), getCurrentUser(), publicUsers(), function (req, res, next) {
    var ctx = req.myContext;
    if (!ctx.get('nodeIsInitialized')) {
      res.set('x-digitopia-hijax-flash-level', 'error');
      res.set('x-digitopia-hijax-flash-message', 'need to setup node');
      if (req.headers['x-digitopia-hijax']) {
        return res.set('x-digitopia-hijax-location', '/setup').send('redirect to ' + '/setup');
      }
      res.redirect('/setup');
    }
    else {
      if (ctx.get('currentUser') && !req.query.access_token) { // if access_token then doing password reset
        if (req.headers['x-digitopia-hijax']) {
          return res.set('x-digitopia-hijax-location', '/feed').send('redirect to ' + '/feed');
        }
        return res.redirect('/feed');
      }

      req.app.models.Post.find({
        'where': {
          'and': [{
            'visibility': {
              'inq': ['public']
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
      }, function (err, posts) {
        if (err) {
          return next(err);
        }

        resolveProfilesForPosts(posts, function (err) {
          resolvePostPhotos(posts, function (err) {
            res.render('pages/home', {
              'user': ctx.get('currentUser'),
              'globalSettings': ctx.get('globalSettings'),
              'publicUsers': ctx.get('publicUsers'),
              'data': {
                'posts': posts
              },
              'passwordResetToken': req.query.access_token,
              'noComments': true,
              'pageTitle': 'Home'
            });
          });
        });
      });
    }
  });

  server.use(router);
};
