(function ($) {
	function dateTimePickerController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.start = function () {
			var local;
			if (self.element.datetimepicker) {
				if (self.element.find('input').val()) {
					local = moment(self.element.find('input').val()).tz(tz);
				}
				self.element.datetimepicker({
					'date': local ? local : '',
					'widgetParent': self.element.closest('.autopost-zone')
				});
			}
		};

		this.stop = function () {
			if (self.element.data('DateTimePicker')) {
				self.element.data('DateTimePicker').destroy();
			}
		};
	}
	$.fn.dateTimePickerController = GetJQueryPlugin('dateTimePickerController', dateTimePickerController);

})(jQuery);
