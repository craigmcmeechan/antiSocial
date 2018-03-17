(function ($) {

	function websocketController(elem) {
		this.element = $(elem);

		var self = this;
		this.endpoint = this.element.data('endpoint');

		this.start = function () {
			var socket = io.connect(self.endpoint);
			socket.on('connect', function () {
				socket.emit('authentication', {
					'subscriptions': {
						'NewsFeedItem': ['after save']
					}
				});
				socket.on('authenticated', function () {
					console.log('authenticated');
					socket.on('data', function (data) {
						console.log(data);
					});
				});
			});
		};
	}

	$.fn.websocketController = GetJQueryPlugin('websocketController', websocketController);

})(jQuery);
