(function ($) {

	function websocketController(elem) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			var socket = io.connect('ws://127.0.0.1:3000');
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
