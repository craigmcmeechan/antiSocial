// add on to formValidator listens for 'validchange' and writes back to url in data-endpoint
(function ($) {
	function saveOnChange(e, options) {
		this.element = $(e);

		var self = this;

		self.queue = {};

		this.start = function () {
			self.element.on('validchange', function (e, input) {
				var $input = $(input);
				if ($input.attr('name')) {
					var value = getRealVal($input);
					var suffix = $input.data('suffix');
					if (suffix) {
						value += '-' + suffix;
					}
					self.queueWriteBack(
						self.element.data('method') ? self.element.data('method') : 'PATCH',
						self.element.data('endpoint'),
						$input.attr('name'),
						value
					);
				}
			});
		};

		this.stop = function () {
			self.element.off('validchange');
		};

		this.queueWriteBack = function (method, endpoint, property, value) {
			if (self.queue[property]) {
				clearTimeout(self.queue[property]);
			}

			flashAjaxStatus('info', 'pending save');

			self.queue[property] = setTimeout(function () {
				self.queue[property] = null;
				self.writeBack(method, endpoint, property, value);
			}, 1000);
		};

		self.writeBack = function (method, endpoint, property, value) {

			var toSave = {};

			toSave[property] = value;

			$.ajax({ // save the data
				type: method,
				url: endpoint,
				data: toSave
			}).done(function (data) {
				flashAjaxStatus('info', 'saved');
			}).fail(function (jqXHR, textStatus, errorThrown) {
				flashAjaxStatus('danger', 'could not save ', textStatus);
			});
		};
	}

	$.fn.saveOnChange = GetJQueryPlugin('saveOnChange', saveOnChange);

})(jQuery);
