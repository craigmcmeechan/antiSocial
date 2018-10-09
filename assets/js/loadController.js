// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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
					setTimeout(function () {
						self.element.remove();
					}, 1000);
				}
				else {
					self.element.html(element.find(self.target).html());
					var json = element.find('.og-json').html();
					self.element.append(json);
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
