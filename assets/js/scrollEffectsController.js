// css replacement scheme by https://github.com/Prinzhorn/skrollr

(function ($) {
	function scrollEffectsController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.startPos = this.element.data('effect-start');
		this.endPos = this.element.data('effect-end');
		this.units = this.element.data('effect-units');
		this.transformUnits = this.element.data('effect-transform-units');
		this.ease = this.element.data('effect-ease') ? this.element.data('effect-ease') : 'swing';
		this.inProgress = false;

		var rxNumericValue = /[\-+]?[\d]*\.?[\d]+/g;
		var rxRGBAIntegerColor = /rgba?\(\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+/g;

		this.start = function () {
			this.startCSS = this.parseCSS($(this.element).data('effect-start-css'));
			this.endCSS = this.parseCSS($(this.element).data('effect-end-css'));

			$(window).scroll(function () {
				self.doEffect();
			});
			self.doEffect(true);
		};

		this.stop = function () {

		};

		this.doEffect = function (force) {
			if (force) {
				self.inProgress = true;
			}
			var top = $(window).scrollTop();
			var start = self.startPos;
			var end = self.endPos;
			var vpHeight = $(window).height();

			if (self.units === 'viewport') {
				start = self.startPos * vpHeight;
				end = self.endPos * vpHeight;
			}

			if (self.inProgress) {
				if (top < start) {
					top = start;
				}
				if (top > end) {
					top = end;
				}
			}

			if (top >= start && top <= end) {
				if (top === start || top === end) {
					self.inProgress = false;
				}
				else {
					self.inProgress = true;
				}
				var duration = end - start;
				var progress = top - start;
				var percent = progress / duration;

				var eased = $.easing[self.ease](percent, percent * duration, 0, 1, duration);

				var newCSS = {};

				for (var property in self.startCSS) {
					var startvals = [];
					var endvals = [];
					var format;
					var format = self.startCSS[property].replace(rxNumericValue, function (n) {
						startvals.push(+n);
						return '{?}';
					});
					format = self.endCSS[property].replace(rxNumericValue, function (n) {
						endvals.push(+n);
						return '{?}';
					});

					var regexPlaceholder = /\{\?\}/;
					var result = format;
					for (var j = 0; j < startvals.length; j++) {

						var startValue = startvals[j];
						var endValue = endvals[j];

						if (self.transformUnits === 'viewport') {
							startValue = startValue * vpHeight;
							endValue = endValue * vpHeight;
						}

						var delta = endValue - startValue;
						var origin = parseFloat(startValue);
						var value = origin + (delta * eased);
						if (self.startCSS[property].match(/rgb\(/)) {
							value = Math.ceil(value);
						}
						result = result.replace(regexPlaceholder, value);
					}
					newCSS[property] = result;
				}
				self.element.css(newCSS);
			}
		};

		this.parseCSS = function (cssString) {
			var css = {};
			if (cssString) {
				var styles = cssString.split(';');
				for (var i = 0; i < styles.length; i++) {
					rxRGBAIntegerColor.lastIndex = 0;
					styles[i] = styles[i].replace(rxRGBAIntegerColor, function (rgba) {
						return rgba.replace(rxNumericValue, function (n) {
							return n / 255 * 100 + '%';
						});
					});
					var regexCSS = /^\s*([a-z\-]+)\s*:\s*(.+)\s*$/gi;
					var found = regexCSS.exec(styles[i]);
					if (found && found.length) {
						css[found[1]] = found[2];
					}
				}
			}
			return css;
		};
	}

	$.fn.scrollEffectsController = GetJQueryPlugin('scrollEffectsController', scrollEffectsController);
})(jQuery);
