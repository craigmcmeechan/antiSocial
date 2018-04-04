(function ($) {
	function dateTimePickerController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			self.element.datetimepicker({
				'date': self.element.find('input').val(),
				'widgetParent': self.element.closest('.autopost-zone')
			});
		};

		this.stop = function () {
			self.element.data('DateTimePicker').destroy();
		};
	}
	$.fn.dateTimePickerController = GetJQueryPlugin('dateTimePickerController', dateTimePickerController);

})(jQuery);
