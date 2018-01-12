var loopback = require('loopback');
var boot = require('loopback-boot');
var i18n = require('i18n');
var bunyan = require('bunyan');
var uuid = require('uuid');
var NodeCache = require("node-cache");

var app = module.exports = loopback();

app.enable('trust proxy');

// use jade templating language
app.set('views', 'server/views');
app.set('view engine', 'pug');
app.locals.pretty = true;

// expose the running environment name to jade
app.locals.env = app.get('env');
app.locals.environment = process.env;
app.locals.getUploadForProperty = require('./lib/getUploadForProperty');
app.locals.moment = require('moment');
app.locals._ = require('lodash');
app.locals.config = require('./config-' + app.get('env'));
app.locals.headshotFPO = '/images/slug.png';
app.locals.FPO = '/images/fpo.jpg';
app.locals.nonce = uuid.v4();
app.locals.myCache = new NodeCache();

// markdown renderer
var marked = require('marked');
var myRenderer = new marked.Renderer();
myRenderer.link = function (href, title, text) {
  if (text && text.match(/^http/i)) {
    return '<div class="ogPreview" data-jsclass="OgTagPreview" data-src="/api/OgTags/scrape" data-url="' + href + '" data-type="json"></div>';
  }
  else {
    if (href.match(/^http/i)) {
      return '<a href="' + href + '" target="_blank">' + text + '</a>';
    }
    return '<a href="' + href + '">' + text + '</a>';
  }
};

marked.setOptions({
  'renderer': myRenderer,
  'smartypants': true
});

function renderMarkdown(markdown) {
  var tagged = markdown.replace(/\#([A-Za-z0-9\-\_\.])+/g, function (tag) {
    return '[' + tag + '](' + tag + ')';
  });

  tagged = tagged.replace(/\(tag\:([^\)]+)\)/g, function (tag) {
    var friendEndPoint = tag;
    friendEndPoint = friendEndPoint.replace(/^\(tag\:/, '');
    friendEndPoint = friendEndPoint.replace(/\)$/, '');
    return '(/proxy-profile?endpoint=' + encodeURIComponent(friendEndPoint) + ')';
  });

  tagged = tagged.replace(/:([A-Za-z0-9_\-\+]+?):/g, function (emoji) {
    return '<span class="em em-' + emoji.replace(/:/g, '') + '"></span>';
  });

  return marked(tagged);
}
app.locals.marked = renderMarkdown;

// localization config
i18n.configure({
  locales: ['en', 'es'],
  cookie: 'locale',
  defaultLocale: 'en',
  directory: './locales',
  fallbacks: {
    'es': 'en'
  },
  autoReload: true,
  updateFiles: false
});
app.use(i18n.init);
app.set('i18n', i18n);

// setup component storage for s3
var ds = loopback.createDataSource({
  connector: require('loopback-component-storage'),
  provider: 'amazon',
  key: process.env.AWS_S3_KEY,
  keyId: process.env.AWS_S3_KEY_ID,
});
var container = ds.createModel('container', {}, {
  base: 'Model'
});
app.model(container, {
  'dataSource': ds,
  'public': true
});


// use loopback.token middleware on all routes
// setup gear for authentication using cookie (access_token)
// Note: requires cookie-parser (defined in middleware.json)
app.use(loopback.token({
  model: app.models.accessToken,
  currentUserLiteral: 'me',
  searchDefaultTokenKeys: false,
  cookies: ['access_token'],
  headers: ['access_token', 'X-Access-Token'],
  params: ['access_token']
}));

// set really long timeout on change-stream routes to prevent
// frequent closing of connections

app.middleware('routes:before', function (req, res, next) {
  if (req.path.indexOf('change-stream') !== -1) {
    res.setTimeout(24 * 3600 * 1000);
    res.set('X-Accel-Buffering', 'no');
    return next();
  }
  else {
    return next();
  }
});

var myContext = require('./middleware/context-myContext')();
app.use(myContext);

// logging

var options = {
  'name': 'anti-social',
  'serializers': {
    'err': bunyan.stdSerializers.err,
    'req': bunyan.stdSerializers.req
  },
  'src': true
};

options.streams = [{
  'level': process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'error',
  'stream': process.stdout
}];

var ravenClient;
if (process.env.RAVEN) {
  app.raven = require('raven');
  app.raven.config(process.env.RAVEN_DSN, {
    'environment': process.env.NODE_ENV,
    'logger': 'default',
    'autoBreadcrumbs': true,
    'stacktrace': true
  }).install();

  var sentryStream = require('bunyan-sentry-stream');
  options.streams.push(sentryStream(app.raven));
}

app.locals.logger = bunyan.createLogger(options);

// attach logger to request
app.use(function (req, res, next) {
  req.logger = app.locals.logger.child({
    'reqId': uuid()
  });
  next();
});

var csp = require('helmet-csp')

app.use(csp({
  'directives': {
    'defaultSrc': ['\'self\''],
    'connect-src': ['\'self\'', 'sentry.io'],
    'scriptSrc': ['\'self\'', 'maps.googleapis.com', 'csi.gstatic.com', 'cdn.ravenjs.com', function (req, res) {
      return '\'nonce-' + app.locals.nonce + '\'';
    }],
    'fontSrc': ['\'self\'', 'fonts.googleapis.com', 'fonts.gstatic.com'],
    'styleSrc': ['\'self\'', 'fonts.googleapis.com', '\'unsafe-inline\''],
    'imgSrc': ['\'self\'', 'csi.gstatic.com', 's3.amazonaws.com'],
    'sandbox': ['allow-forms', 'allow-scripts', 'allow-same-origin', 'allow-popups'],
    'reportUri': '/csp-violation',
    'objectSrc': ['\'none\''],
    'upgradeInsecureRequests': false
  },
  'loose': false,
  'reportOnly': false,
  'setAllHeaders': false,
  'disableAndroid': false,
  'browserSniff': false
}));


// attach settings to req
var globalSettings = require('./middleware/context-globalSettings')();
app.use(globalSettings);

// put currentUser in req.context on /api routes
var getCurrentUserApi = require('./middleware/context-currentUserApi')();
app.use(getCurrentUserApi);

// use basic-auth for development environment
if (app.get('env') === 'development') {
  var basicAuth = require('./middleware/basicAuth')();
  app.use(basicAuth);
}

app.start = function () {
  // start the web server
  return app.listen(function () {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    app.locals.logger.info('Web server listening at: %s (%s) ', baseUrl, app.get('env'));
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      app.locals.logger.info('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
