(function ($) {
	function getEndpointController(elem, options) {
		this.element = $(elem);
		this.prompt = this.element.html();
		var self = this;

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
			$.get(self.element.data('endpoint'))
				.done(function (data, textStatus, jqXHR) {
					var flashLevel = jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') ? jqXHR.getResponseHeader('x-digitopia-hijax-flash-level') : 'info';
					var flashMessage = jqXHR.getResponseHeader('x-digitopia-hijax-flash-message') ? jqXHR.getResponseHeader('x-digitopia-hijax-flash-message') : 'saved';
					flashAjaxStatus(flashLevel, flashMessage);
					$('body').trigger('DigitopiaReloadPage');
				}).fail(function () {
					flashAjaxStatus('error', 'action failed');
					self.element.html(self.prompt);
				});
		};
	}
	$.fn.getEndpointController = GetJQueryPlugin('getEndpointController', getEndpointController);
})(jQuery);
