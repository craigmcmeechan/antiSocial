(function ($) {
	var pollingInterval = 1000 * 30;

	function communityPollingController(elem, options) {
		this.element = $(elem);

		this.threads = [];
		this.timer = null;
		this.endpoint = this.element.data('endpoint');
		this.since = this.element.data('since');
		var self = this;

		this.start = function () {
			self.timer = setInterval(function () {
				self.poll();
			}, pollingInterval);
			self.poll();
		};

		this.stop = function () {
			if (self.timer) {
				clearInterval(self.timer);
				self.timer = null;
			}
		};

		this.poll = function () {
			flashAjaxStatus('info', 'loading');
			var url = self.endpoint;
			if (self.since) {
				url += '?since=' + self.since;
			}
			var options = {
				'method': 'GET',
				'url': url,
			};
			$.ajax(options)
				.done(function (data, textStatus, jqXHR) {
					if (data.posts) {
						for (var i = 0; i < data.posts.length; i++) {
							var post = data.posts[i];
							if (post.about) {
								console.log('new comment about' + post.about);
							}
							else {
								console.log('new post', post.athoritativeEndpoint);
							}
						}
					}
					self.since = data.since;
				})
				.fail(function (jqXHR, textStatus, errorThrown) {
					flashAjaxStatus('info', textStatus);
				});
		};
	}
	$.fn.communityPollingController = GetJQueryPlugin('communityPollingController', communityPollingController);
})(jQuery);
