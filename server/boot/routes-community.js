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


var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();


  // public feed
  router.get('/community', getCurrentUser(), ensureLoggedIn(), publicUsers(), function (req, res, next) {
    var ctx = req.myContext;

    var query = {
      'where': {
        'visibility': {
          'inq': ['community']
        }
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

      var settings = ctx.get('globalSettings');

      resolveProfilesForPosts(posts, function (err) {
        resolvePostPhotos(posts, function (err) {
          res.header('x-highwater', highwater);
          res.render('pages/community', {
            'user': ctx.get('currentUser'),
            'globalSettings': settings,
            'publicUsers': ctx.get('publicUsers'),
            'data': {
              'posts': posts
            },
            'community': settings.community
          });
        });
      });
    });
  });

  server.use(router);
};