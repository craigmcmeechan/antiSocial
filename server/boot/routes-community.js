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

    req.app.models.Post.find({
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
    }, function (err, posts) {
      if (err) {
        return next(err);
      }

      resolveProfilesForPosts(posts, function (err) {
        resolvePostPhotos(posts, function (err) {
          res.render('pages/community', {
            'user': ctx.get('currentUser'),
            'globalSettings': ctx.get('globalSettings'),
            'publicUsers': ctx.get('publicUsers'),
            'data': {
              'posts': posts
            },
            'community': {
              'name': 'My Community Name',
              'tagline': 'My Community Tagline',
              'background': {
                'url': '/images/fpo.jpg',
                'smallUrl': '/images/fpo.jpg'
              }
            }
          });
        });
      });
    });
  });

  server.use(router);
};
