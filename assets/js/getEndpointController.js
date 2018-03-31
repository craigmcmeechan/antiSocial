(function ($) {
	function getEndpointController(elem, options) {
		this.element = $(elem);
		this.prompt = this.element.html();

		var self = this;

		self.method = self.element.data('method') ? self.element.data('method') : 'GET';
		self.data = self.element.data('data') ? self.element.data('data') : null;

		this.start = function () {
			this.element.on('click', function (e) {
				e.preventDefault();
				self.element.html('<i class="fa fa-circle-o-notch fa-spin"></i> Loading.');
				self.doIt();
			});
		};

		this.stop = function () {
			this.element.off('click');
		};

		this.doIt = function () {
			flashAjaxStatus('info', 'saving');
			var options = {
				url: self.element.data('endpoint'),
				method: self.method,
				data: self.data
			}
			$.ajax(options)
				.done(function (data, textStatus, jqXHR) {
					var flashLevel = jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') ? jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') : 'info';
					var flashMessage = jqXHR.getResponseHeader('x-digitopia-hijax-flash-message') ? jqXHR.getResponseHeader('x-digitopia-hijax-flash-message') : 'saved';
					flashAjaxStatus(flashLevel, flashMessage);
					$('body').trigger('DigitopiaReloadPage');
				}).fail(function () {
					flashAjaxStatus('danger', 'action failed');
					self.element.html(self.prompt);
				});
		};
	}
	$.fn.getEndpointController = GetJQueryPlugin('getEndpointController', getEndpointController);
})(jQuery);
