(function ($) {
	function liveTimeController(elem) {
		this.element = $(elem);
		var self = this;

		this.tz;
		this.updateTimestamps;

		this.start = function () {

			self.tz = moment.tz(moment.tz.guess()).zone() - moment().zone();

			self.updateTimestamps = setInterval(function () {
				self.updateTimes();
			}, 10000);

			this.element.on('DigitopiaDidScroll', function (event) {
				self.updateTimes();
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
					var delta = self.getDeltaTime($(this).data('timestamp'));
					$(this).html(delta);
				}
			});
		};

		this.getDeltaTime = function (timestamp) {
			var delta;
			if (moment().diff(moment(timestamp), 'hours') > 24) {
				delta = moment(timestamp).calendar();
			}
			else {
				delta = moment(timestamp).fromNow();
			}
			return delta;
		};

	}

	$.fn.liveTimeController = GetJQueryPlugin('liveTimeController', liveTimeController);
})(jQuery);
