(function ($) {
	function liveNewsFeedItemWebsocketController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.socket = null;
		this.active = false;
		this.pendingConnection = null;
		this.endpoint = this.element.data('endpoint');

		this.start = function () {
			self.element.on('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged', function () {
				self.checkActive();
			});
			self.checkActive();
		};

		this.stop = function () {
			if (self.active) {
				self.disconnect();
			}
			self.element.off('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged');
		};

		// check if state has changed and connect/disconnect if needed
		this.checkActive = function () {
			var state = $('#document-body').hasClass('is-logged-in');

			if (state !== self.active) {
				if (self.active) {
					self.disconnect();
				}
				else {
					self.connect();
				}
			}

			self.active = state;

			self.setTop();
		};

		// position and maintain visibility
		this.setTop = function () {
			if (self.active) {
				if ($('#newsfeed-here').length) {
					var top = $('#newsfeed-here').offset().top;
					var width = $('#newsfeed-here').width();
					var left = $('#newsfeed-here').offset().left;
					self.element.css({
						'top': top,
						'width': width,
						'left': left
					});

					if (!$('#document-body').hasClass('digitopia-xsmall')) {
						self.element.show();
					}
				}
				else {
					self.element.hide();
				}
			}
			else {
				self.element.hide();
			}
		};

		this.connect = function () {
			if (self.pendingConnection) {
				clearTimeout(self.pendingConnection)
			}
			self.pendingConnection = setTimeout(function () {
				self.pendingConnection = null;
				self.element.find('ul').empty();
				self.socket = io.connect(self.endpoint);
				self.socket.on('connect', function () {
					self.socket.emit('authentication', {
						'subscriptions': {
							'NewsFeedItem': ['after save']
						}
					});
					self.socket.on('authenticated', function () {
						console.log('authenticated');
						self.socket.on('data', self.processNews);
						self.socket.on('disconnect', self.errors);
					});
				});
				self.setTop();
			}, 5000);
		};

		this.disconnect = function () {
			self.element.find('.news-feed-items').empty();
			if (self.socket) {
				self.socket.close();
				self.socket = null;
			}
			self.element.hide();
		};

		this.processNews = function (event) {
			self.element.find('.status').removeClass('offline');
			if (event.type === 'heartbeat') {
				return;
			}
			var formatted = event.data.humanReadable;
			if (formatted) {
				var li = $('<div class="news-feed-item">');
				li.append(formatted);
				self.element.find('.news-feed-items').prepend(li);
				didInjectContent(self.element);
			}
			if (!event.backfill) {
				if (event.data.type === 'post') {
					var item = $('<div>');
					var endpoint = event.data.about;
					item.load(endpoint, function () {
						var post = item.find('.newsfeed-item');
						$('#scope-post-list').prepend(post);
						didInjectContent($('#scope-post-list').find('.newsfeed-item')[0]);
					});
				}
				else if (event.data.type === 'post edit') {
					$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.about]);
				}
				else if (event.data.type === 'comment') {
					$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.about + '/comment/' + event.data.uuid, event.type]);
				}
				else if (event.data.type === 'react') {
					$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.about + '/reactions']);
				}
				// TODO: need icon and text delimited
				// notifyUser(event.data.type, message, icon, '/proxy-post?endpoint=' + encodeURIComponent(event.data.about));
			}
		};

		this.errors = function (e) {
			self.disconnect();
			self.connect();
		};
	}

	$.fn.liveNewsFeedItemWebsocketController = GetJQueryPlugin('liveNewsFeedItemWebsocketController', liveNewsFeedItemWebsocketController);
})(jQuery);
