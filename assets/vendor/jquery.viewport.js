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
    return fold <= $(element).offset().top - settings.threshold;
  };

  $.abovethetop = function (element, settings) {
    var top = $(scrollViewport).scrollTop();
    return top >= $(element).offset().top + $(element).height() - settings.threshold;
  };

  $.rightofscreen = function (element, settings) {
    var fold = $(window).width() + $(scrollViewport).scrollLeft();
    return fold <= $(element).offset().left - settings.threshold;
  };

  $.leftofscreen = function (element, settings) {
    var left = $(scrollViewport).scrollLeft();
    return left >= $(element).offset().left + $(element).width() - settings.threshold;
  };

  $.inviewport = function (element, settings) {
    console.log('scroll pos:', $(scrollViewport).scrollTop(), ' offset:', $(element).offset().top);
    if (!$.rightofscreen(element, settings) && !$.leftofscreen(element, settings) && !$.belowthefold(element, settings) && !$.abovethetop(element, settings)) {
      $(element).removeClass('not-in-viewport').addClass('in-viewport');
    }
    else {
      $(element).removeClass('in-viewport').addClass('not-in-viewport');
    }

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
