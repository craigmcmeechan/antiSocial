(function ($) {
	var pollingInterval = 1000 * 30;

	function communityPollingController(elem, options) {
		this.element = $(elem);

		this.threads = [];
		this.timer = null;
		this.endpoint = this.element.data('endpoint');
		this.lastPoll = '';
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
			if (self.lastPoll) {
				url += '?since=' + self.lastPoll;
			}
			var options = {
				'method': 'GET',
				'url': url,
			};
			$.ajax(options)
				.done(function (data, textStatus, jqXHR) {
					console.log(data);
					self.lastPoll = data.since;
				})
				.fail(function (jqXHR, textStatus, errorThrown) {
					flashAjaxStatus('info', textStatus);
				});
		};
	}
	$.fn.communityPollingController = GetJQueryPlugin('communityPollingController', communityPollingController);
})(jQuery);
