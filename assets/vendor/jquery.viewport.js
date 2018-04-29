/*
 * Viewport - jQuery selectors for finding elements in viewport
 *
 * Copyright (c) 2008-2009 Mika Tuupola
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Project home:
 *  http://www.appelsiini.net/projects/viewport
 *
 */
(function ($) {

  $.belowthefold = function (element, settings) {
    var fold = $(window).height() + $(scrollViewport).scrollTop();
    //console.log($(element).attr('id') + ' belowthefold ' + (fold <= $(element).offset().top - settings.threshold));
    return fold <= ($(element).offset().top - $(scrollViewport).offset().top) - settings.threshold;
  };

  $.abovethetop = function (element, settings) {
    var top = $(scrollViewport).scrollTop();
    //console.log($(element).attr('id') + ' abovethetop ' + (top >= $(element).offset().top + $(element).height() - settings.threshold));
    return top >= ($(element).offset().top - $(scrollViewport).offset().top) + $(element).height() - settings.threshold;
  };

  $.rightofscreen = function (element, settings) {
    var fold = $(window).width() + $(scrollViewport).scrollLeft();
    return fold <= ($(element).offset().left - $(scrollViewport).offset().left) - settings.threshold;
  };

  $.leftofscreen = function (element, settings) {
    var left = $(scrollViewport).scrollLeft();
    return left >= ($(element).offset().left - $(scrollViewport).offset().left) + $(element).width() - settings.threshold;
  };

  $.inviewport = function (element, settings) {
    /*
    if (!$.rightofscreen(element, settings) && !$.leftofscreen(element, settings) && !$.belowthefold(element, settings) && !$.abovethetop(element, settings)) {
      console.log($(element).attr('id') + ' is in viewport');
    }
    else {
      console.log($(element).attr('id') + ' is not in viewport');
    }
    */
    return !$.rightofscreen(element, settings) && !$.leftofscreen(element, settings) && !$.belowthefold(element, settings) && !$.abovethetop(element, settings);
  };

  $.extend($.expr[':'], {
    "below-the-fold": function (a, i, m) {
      return $.belowthefold(a, {
        threshold: 0
      });
    },
    "above-the-top": function (a, i, m) {
      return $.abovethetop(a, {
        threshold: 0
      });
    },
    "left-of-screen": function (a, i, m) {
      return $.leftofscreen(a, {
        threshold: 0
      });
    },
    "right-of-screen": function (a, i, m) {
      return $.rightofscreen(a, {
        threshold: 0
      });
    },
    "in-viewport": function (a, i, m) {
      return $.inviewport(a, {
        threshold: 0
      });
    }
  });


})(jQuery);
