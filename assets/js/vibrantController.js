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

			var vibrant = new Vibrant(self.element.data('image'));
			var swatches = vibrant.getPalette(function (err, palette) {
				if (!err) {
					cache[self.element.data('image')] = palette;

					/*
					for (var swatch in palette) {
						if (palette.hasOwnProperty(swatch) && palette[swatch]) {
							console.log(swatch, palette[swatch].getHex ? palette[swatch].getHex() : 'wha?');
							console.log(swatch + 'title', palette[swatch].getTitleTextColor());
							console.log(swatch + 'body', palette[swatch].getBodyTextColor());
						}
					}
					*/

					self.setColors(palette);
				}
			});
		};

		this.stop = function () {
			//$('#override-styles').empty();
		};

		this.setColors = function (swatches) {
			var top = swatches.Muted ? swatches.Muted.getHex() : '#eee';
			var bottom = swatches.DarkMuted ? swatches.DarkMuted.getHex() : '#ccc';
			var links = swatches.DarkVibrant ? swatches.DarkVibrant.getHex() : '#333';
			var hover = swatches.Vibrant ? swatches.Vibrant.getHex() : '#333';
			var text = swatches.DarkMuted ? swatches.DarkMuted.getHex() : '#333';
			var secondary = swatches.LightMuted ? swatches.LightMuted.getHex() : '#ccc';

			var bg = {
				'background': 'linear-gradient(to bottom right,' + top + ',' + bottom + ')'
			};

			self.element.css(bg);

			var styles = '.vibrant {color:' + text + '!important;}\n';
			styles += '.vibrant h1,.vibrant h2, .vibrant h3,.vibrant h4,.vibrant h5,.vibrant h6,.vibrant .h1,.vibrant .h2,.vibrant .h3,.vibrant .h4,.vibrant .h5,.vibrant .h6 { color:' + text + '!important;}\n';
			styles += '.vibrant a{color:' + links + '!important;}\n';
			styles += '.vibrant a:hover{color:' + hover + '!important;}\n';
			styles += '.vibrant a:visited{color:' + links + ';}\n';
			styles += '.vibrant .secondary{color:' + secondary + '!important;}\n';

			$('#override-styles').empty().append(styles);
		};

	}

	$.fn.vibrantController = GetJQueryPlugin('vibrantController', vibrantController);
})(jQuery);
