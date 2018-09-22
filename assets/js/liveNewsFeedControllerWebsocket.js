// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function liveNewsFeedItemWebsocketController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.socket = null;
		this.active = false;
		this.pendingConnection = null;
		this.endpoint = this.element.data('endpoint');
		this.reconnecting = false;
		this.newItems = 0;

		this.endpoint = this.endpoint.replace(/^https/, 'wss');
		this.endpoint = this.endpoint.replace(/^http/, 'ws');

		this.start = function () {
			self.element.on('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged', function () {
				self.checkActive();
			});
			self.checkActive();
			this.updateBadge();
		};

		this.stop = function () {
			if (this.socket) {
				self.disconnect();
			}
			self.element.off('DidLogOut DidLogIn DigitopiaDidLoadNewPage DigitopiaDidResize DigitopiaScaleChanged');
		};

		// check if state has changed and connect/disconnect if needed
		this.checkActive = function () {
			var state = $('#document-body').hasClass('is-logged-in');

			if (state !== self.loggedIn) {
				self.loggedIn = state;

				if (!state) { //
					self.disconnect();
				}
				else {
					self.connect();
				}
			}
		};

		this.connect = function () {
			if (self.pendingConnection) {
				clearTimeout(self.pendingConnection);
			}

			self.pendingConnection = setTimeout(function () {
				flashAjaxStatus('info', 'connecting');
				self.pendingConnection = null;
				self.element.find('ul').empty();

				// if in native app fix endpoint to point to server
				var endpoint = self.endpoint;
				if (window.Cordova) {
					endpoint = server;
					endpoint = endpoint.replace(/^https/, 'wss');
					endpoint = endpoint.replace(/^http/, 'ws');
				}

				self.socket = io.connect(endpoint, {
					'path': '/antisocial-notifications'
				});

				self.socket.on('disconnect', function () {
					self.disconnect();
				});

				self.socket.on('reconnecting', function (attempt) {
					flashAjaxStatus('info', 'attempting reconnect ' + attempt);
				});

				self.socket.on('reconnect_error', function () {
					flashAjaxStatus('info', 'reconnect attempt failed');
				});

				self.socket.on('error', self.errors);

				self.socket.on('connect', function () {
					self.socket.emit('authentication', {});
					self.socket.on('authenticated', function () {
						flashAjaxStatus('info', 'online');
						self.socket.on('data', self.processNews);
						$('body').removeClass('offline');
						var highwater = self.getHighwater();
						if (!highwater) {
							highwater = moment().subtract(1, 'd').toISOString()
						}
						self.socket.emit('highwater', {
							'appId': 'myantisocialnet',
							'data': highwater
						});
						self.socket.emit('data', {
							'appId': 'myantisocialnet',
							'data': {
								'hello': 'world'
							}
						});
					});
				});

			}, self.reconnecting ? 10000 : 0);
		};

		this.disconnect = function (noReconnect) {
			flashAjaxStatus('info', 'offline');
			$('body').addClass('offline');
			self.element.find('.news-feed-items').empty();
			if (self.socket) {
				self.socket.disconnect();
				self.socket = null;
			}
			self.reconnecting = false;
			if (self.loggedIn && !noReconnect) {
				self.reconnecting = true;
				self.connect();
			}
		};

		this.clearCounter = function () {
			self.newItems = 0;
			self.element.find('.is-new').removeClass('is-new');
			self.updateBadge();
		};

		this.updateBadge = function () {
			$('.activity-count').html(self.newItems);
			if (self.newItems) {
				$('.activity-count').show();
			}
			else {
				$('.activity-count').hide();
			}
		};

		this.processNews = function (event) {
			var message = event.data;
			if (message.type === 'offline') {
				self.disconnect(true);
				return;
			}
			var formatted = $(message.data.humanReadable);
			if (formatted && !message.data.deleted && message.type !== 'update' && !message.isMe) {
				var li = $('<div class="news-feed-item">');
				formatted.append('<br><span class="post-timestamp timestamp" data-timestamp="' + moment(message.data.updatedOn).toISOString() + '"></span>');
				li.append(formatted);
				self.element.find('.news-feed-items').prepend(li);
				didInjectContent(self.element);
				if (self.getHighwater() < message.data.updatedOn) {
					li.addClass('is-new');
					++self.newItems;
					self.saveHighwater(message.data.updatedOn);
					self.updateBadge();
				}
				li.data('about', message.endpoint);
			}
			if (!message.backfill) {
				if (message.data.type === 'post' && message.type === 'create') {
					var isFeed = $('#is-feed').length;
					var isProfile = $('#is-profile').length;
					var me = $('#is-profile').data('me');
					if (isFeed || (isProfile && me === message.data.source)) {
						var item = $('<div>');
						var endpoint = '/proxy-post?endpoint=' + encodeURIComponent(message.data.about);
						item.load(endpoint, function () {
							var post = item.find('.newsfeed-item');
							$('#scope-post-list').prepend(post);
							didInjectContent($('#scope-post-list').find('.newsfeed-item')[0]);
						});
					}
				}
				else if (message.data.type === 'post' && message.type === 'update') {
					if (message.data.deleted) {
						$('body').trigger('NotifyLiveElement', [message.data.type, message.data.about, message.data.about, 'delete']);
					}
					else {
						$('body').trigger('NotifyLiveElement', [message.data.type, message.data.about, message.data.about]);
					}
				}
				else if (message.data.type === 'comment') {
					$('body').trigger('NotifyLiveElement', [message.data.type, message.data.about, message.data.about + '/comment/' + message.data.uuid, message.type, message.data]);
				}
				else if (message.data.type === 'react') {
					$('body').trigger('NotifyLiveElement', [message.data.type, message.data.about, message.data.about + '/reactions']);
				}
				// TODO: need icon and text delimited
				// notifyUser(event.data.type, message, icon, '/proxy-post?endpoint=' + encodeURIComponent(event.data.about));
			}
		};

		this.errors = function (e) {
			self.disconnect();
		};

		this.getHighwater = function () {
			return $.cookie('notify-highwater') ? $.cookie('notify-highwater') : '';
		};

		this.saveHighwater = function (highwater) {
			var options = {
				path: '/',
				expires: 365,
			};
			$.cookie('notify-highwater', highwater, options);
		};
	}

	$.fn.liveNewsFeedItemWebsocketController = GetJQueryPlugin('liveNewsFeedItemWebsocketController', liveNewsFeedItemWebsocketController);
})(jQuery);
