var getCurrentUser = require('../middleware/context-currentUser');
var ensureLoggedIn = require('../middleware/context-ensureLoggedIn');
var debug = require('debug')('routes');
var debugVerbose = require('debug')('routes:verbose');

module.exports = function (server) {
  var router = server.loopback.Router();


  // preferences and activity
  router.get('/settings', getCurrentUser(), ensureLoggedIn(), function (req, res, next) {
    var ctx = req.myContext;
    var isAdmin = false;
    if (ctx.get('currentUserRoles')) {
      var roles = ctx.get('currentUserRoles');
      for (var i = 0; i < roles.length; i++) {
        if (roles[i].role().name === 'admin') {
          isAdmin = true;
        }
      }
    }

    res.render('pages/settings', {
      'user': ctx.get('currentUser'),
      'globalSettings': ctx.get('globalSettings'),
      'userSettings': ctx.get('userSettings'),
      'isAdmin': isAdmin
    });
  });

  server.use(router);
};
