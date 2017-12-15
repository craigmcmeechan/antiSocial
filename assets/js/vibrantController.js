(function ($) {
	var cache = {};

	function vibrantController(elem, options) {
		this.element = $(elem);
		var self = this;

		this.start = function () {
			if (cache[self.element.data('image')]) {
				self.setColors(cache[self.element.data('image')]);
				return;
			}
			var img = document.createElement('img');
			img.crossOrigin = "Anonymous";
			img.setAttribute('src', self.element.data('image'));

			img.addEventListener('load', function () {
				var vibrant = new Vibrant(img);
				var swatches = vibrant.swatches();
				cache[self.element.data('image')] = swatches;
				self.setColors(swatches);

				/*
				for (var swatch in swatches) {
					if (swatches.hasOwnProperty(swatch) && swatches[swatch]) {
						console.log(swatch, swatches[swatch].getHex());
						console.log(swatch + 'title', swatches[swatch].getTitleTextColor());
						console.log(swatch + 'body', swatches[swatch].getBodyTextColor());
					}
				}
				*/

			});
		};

		this.setColors = function (swatches) {
			var top = swatches.Muted ? swatches.Muted.getHex() : '#eee';
			var bottom = swatches.DarkMuted ? swatches.DarkMuted.getHex() : '#ccc';
			var links = swatches.Vibrant ? swatches.Vibrant.getHex() : 'navy';
			var hover = swatches.DarkVibrant ? swatches.DarkVibrant.getHex() : 'blue';
			var text = swatches.DarkMuted ? swatches.DarkMuted.getHex() : '#333';

			//var top = swatches.Muted ? swatches.Muted.getRgb() : '#eee';
			//var toptrans = 'rgba(' + top[0] + ',' + top[1] + ',' + top[2] + ',.9)';

			var bg = {
				'background': 'linear-gradient(to bottom right,' + top + ',' + bottom + ')'
			};
			self.element.css(bg);
			//var styles = 'body{color:' + text + '}a{color:' + links + ';}a:hover{color:' + hover + ';}';
			var styles = 'a{color:' + links + ';}a:hover{color:' + hover + ';}a:visited{color:' + text + '}';
			$('#override-styles').empty().append(styles);
		};

	}

	$.fn.vibrantController = GetJQueryPlugin('vibrantController', vibrantController);
})(jQuery);
