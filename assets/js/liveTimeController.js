// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

(function ($) {
	function liveTimeController(elem) {
		this.element = $(elem);
		var self = this;

		this.updateTimestamps = null;
		this.tz = moment.tz.guess();

		this.start = function () {

			self.updateTimestamps = setInterval(function () {
				self.updateTimes();
			}, 10000);

			this.element.on('DigitopiaDidScroll', function (e) {
				if (e.target === this) {
					self.updateTimes();
				}
			});

			self.updateTimes();
		};

		this.stop = function () {
			if (self.updateTimestamps) {
				clearInterval(self.updateTimestamps);
				self.updateTimestamps = null;
			}
			this.element.off('DigitopiaDidScroll');
		};

		this.updateTimes = function () {
			$('.timestamp:in-viewport').each(function () {
				if ($(this).data('timestamp')) {
					var delta = self.getDeltaTime($(this).data('timestamp'), $(this).data('format'));
					$(this).html(delta);
				}
			});
		};

		this.getDeltaTime = function (timestamp, format) {
			if (format === 'absolute') {
				return moment(timestamp).tz(self.tz).format('LLLL');
			}

			var delta;
			if (moment().diff(moment(timestamp), 'hours') > 48) {
				delta = moment(timestamp).tz(self.tz).calendar().split(' at')[0];
			}
			else {
				delta = moment(timestamp).fromNow();
			}
			return delta;
		};
	}

	$.fn.liveTimeController = GetJQueryPlugin('liveTimeController', liveTimeController);
})(jQuery);
