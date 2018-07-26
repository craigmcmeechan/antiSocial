// Copyright Michael Rhodes. 2017,2018. All Rights Reserved.
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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

			var title = swatches.Muted.getTitleTextColor();
			var text = swatches.Muted.getBodyTextColor();

			var styles = '.vibrant {color:' + text + '!important;}\n';
			styles += '.vibrant-bg .vibrant-typography { color:' + text + '!important;}\n';
			styles += '.vibrant-bg .vibrant-typography a{color:' + title + '!important;}\n';
			styles += '.vibrant-bg .vibrant-typography a:hover{color:' + title + '!important;}\n';
			styles += '.vibrant-bg .vibrant-typography a:visited{color:' + title + ';}\n';
			styles += '.vibrant-bg .vibrant-typography .secondary{color:' + text + '!important;}\n';
			styles += '.vibrant-bg { background: linear-gradient(to bottom right,' + top + ',' + bottom + ')};\n';
			styles += '.vibrant-border { border-color:' + bottom + '!important};\n';

			$('#override-styles').empty().append(styles);
		};

	}

	$.fn.vibrantController = GetJQueryPlugin('vibrantController', vibrantController);
})(jQuery);
