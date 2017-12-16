(function ($) {
	function loadController(elem, options) {
		this.element = $(elem);
		var self = this;
		this.endpoint = self.element.data('endpoint');
		this.target = self.element.data('target');
		this.start = function () {
			var element = $('<div>');
			element.load(self.endpoint, function () {
				self.element.html(element.find(self.target).html());
				didInjectContent(self.element);
			})
		};

		this.stop = function () {

		};
	}

	$.fn.loadController = GetJQueryPlugin('loadController', loadController);
})(jQuery);
