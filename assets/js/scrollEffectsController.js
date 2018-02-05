// css replacement scheme by https://github.com/Prinzhorn/skrollr

(function ($) {
	var pendingAnimationFrame = undefined;
	var animationQueue = [];

	function flushAnimationQueue() {
		if (pendingAnimationFrame) {
			cancelAnimationFrame(pendingAnimationFrame);
			pendingAnimationFrame = undefined;
		}
		animationQueue = [];
	}

	function queueAnimation(frame) {
		animationQueue.push(frame);
		if (!pendingAnimationFrame) {
			pendingAnimationFrame = requestAnimationFrame(processAnimationQueue);
		}
	}

	function processAnimationQueue() {
		pendingAnimationFrame = undefined;
		var toProcess = animationQueue;
		animationQueue = [];
		for (var i = 0; i < toProcess.length; i++) {
			toProcess[i]();
		}
	}

	function scrollEffectsController(elem, options) {
		this.element = $(elem);

		var self = this;

		this.startPos = this.element.data('effect-start');
		this.endPos = this.element.data('effect-end');
		this.units = this.element.data('effect-units');
		this.transformUnits = this.element.data('effect-transform-units');
		this.ease = this.element.data('effect-ease') ? this.element.data('effect-ease') : 'swing';
		this.timed = this.element.data('timed');

		this.lastCSS = null;

		var rxNumericValue = /[\-+]?[\d]*\.?[\d]+/g;
		var rxRGBAIntegerColor = /rgba?\(\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+/g;

		this.start = function () {
			if (self.element.data('bg')) {
				self.element.css('background-image', 'url(' + self.element.data('bg') + ')');
			}
			this.startCSS = this.parseCSS($(this.element).data('effect-start-css'));
			this.endCSS = this.parseCSS($(this.element).data('effect-end-css'));
			self.doEffect(true);
		};

		this.stop = function () {
			flushAnimationQueue();
		};

		this.doEffect = function (force) {
			var top = $(window).scrollTop();
			var start = self.startPos;
			var end = self.endPos;
			var vpHeight = $(window).height();

			if (self.units === 'viewport') {
				start = self.startPos * vpHeight;
				end = self.endPos * vpHeight;
			}

			if (top < start) {
				top = start;
			}
			if (top > end) {
				top = end;
			}

			if (force || (top >= start && top <= end)) {

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

				if (JSON.stringify(newCSS) !== self.lastCSS) {
					self.element.css(newCSS);
					self.lastCSS = JSON.stringify(newCSS);
				}
			}

			queueAnimation(function () {
				self.doEffect();
			});
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
