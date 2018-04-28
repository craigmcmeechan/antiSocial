var app = {
  initialize: function () {
    document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
  },
  onDeviceReady: function () {
    this.receivedEvent('deviceready');
  },
  receivedEvent: function (id) {
    console.log('Received Event: ' + id);
  }
};

app.initialize();

var server = 'http://127.0.0.1:3000';

function rewriteUrls(path) {
  if (window.Cordova && path.match(/^\//)) {
    return server + path;
  }
  else {
    return path;
  }
}


(function ($) {
  var accessToken;

  if ($.cookie('server')) {
    server = $.cookie('server');
  }

  $(document).ajaxSend(function (event, jqxhr, settings) {
    if (window.Cordova) {
      settings.xhrFields = {
        'withCredentials': true
      }

      if (settings.url.match(/^\//)) {
        settings.url = server + settings.url;
      }
      if (accessToken) {
        jqxhr.setRequestHeader('access_token', accessToken);
      }
    }
  });

  $(document).ajaxSuccess(function (event, xhr, settings) {
    if (window.Cordova) {
      if (settings.url.match(/\/login$/)) {
        accessToken = xhr.responseJSON ? xhr.responseJSON.id : null;
      }

      if (settings.url.match(/\/logout$/)) {
        accessToken = null;
      }
    }
  });

})(jQuery);
