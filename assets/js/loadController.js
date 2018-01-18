(function ($) {
	function loadController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.endpoint = self.element.data('endpoint');
		this.target = self.element.data('target');
		this.start = function () {
			var element = $('<div>');
			element.load(self.endpoint, function (response, status, xhr) {
				if (status == "error") {
					var msg = "Sorry but there was an error: ";
					self.element.html(msg + xhr.status + " " + xhr.statusText);
				}
				else {
					self.element.html(element.find(self.target).html());
				}
				self.element.removeClass('loading');
				didInjectContent(self.element);
			})
		};

		this.stop = function () {

		};
	}

	$.fn.loadController = GetJQueryPlugin('loadController', loadController);
})(jQuery);
