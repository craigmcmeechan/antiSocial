(function ($) {
	function liveNewsFeedItemWebsocketController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.socket = null;
		this.active = false;
		this.pendingConnection = null;
		this.endpoint = this.element.data('endpoint');
		this.reconnecting = false;

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
				}
			}
		};

		this.connect = function () {
			if (self.pendingConnection) {
				clearTimeout(self.pendingConnection)
			}
			self.pendingConnection = setTimeout(function () {
				flashAjaxStatus('info', 'connecting');
				self.pendingConnection = null;
				self.element.find('ul').empty();
				self.socket = io.connect(self.endpoint);
				self.socket.on('disconnect', self.errors);
				self.socket.on('error', self.errors);
				self.socket.on('connect', function () {
					self.socket.emit('authentication', {
						'subscriptions': {
							'NewsFeedItem': ['after save']
						}
					});
					self.socket.on('authenticated', function () {
						flashAjaxStatus('info', 'online');
						self.socket.on('data', self.processNews);
						$('body').removeClass('offline');
					});
				});
				self.setTop();
			}, self.reconnecting ? 1000 : 0);
		};

		this.disconnect = function () {
			flashAjaxStatus('info', 'offline');
			$('body').addClass('offline');
			self.element.find('.news-feed-items').empty();
			if (self.socket) {
				self.socket.close();
				self.socket = null;
			}
		};

		this.processNews = function (event) {
			if (event.type === 'offline') {
				self.disconnect();
				return;
			}
			var formatted = $(event.data.humanReadable);
			if (formatted && !event.data.deleted && event.type !== 'update' && !event.isMe) {
				var li = $('<div class="news-feed-item">');
				formatted.append('<br><span class="post-timestamp timestamp" data-timestamp="' + moment(event.data.updatedOn).toISOString() + '"></span>');
				li.append(formatted);
				self.element.find('.news-feed-items').prepend(li);
				didInjectContent(self.element);
			}
			if (!event.backfill) {
				if (event.data.type === 'post' && event.type === 'create') {
					var item = $('<div>');
					var endpoint = event.data.about;
					item.load(endpoint, function () {
						var post = item.find('.newsfeed-item');
						$('#scope-post-list').prepend(post);
						didInjectContent($('#scope-post-list').find('.newsfeed-item')[0]);
					});
				}
				else if (event.data.type === 'post' && event.type === 'update') {
					if (event.data.deleted) {
						$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.about, 'delete']);
					}
					else {
						$('body').trigger('NotifyLiveElement', [event.data.type, event.data.about, event.data.about]);
					}
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
			console.log(e);
			self.reconnecting = true;
			self.disconnect();
			self.connect();
		};
	}

	$.fn.liveNewsFeedItemWebsocketController = GetJQueryPlugin('liveNewsFeedItemWebsocketController', liveNewsFeedItemWebsocketController);
})(jQuery);
