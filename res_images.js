(function ($) {

  // for testing purposes clear local storage each time to remove cached network speed tests
  try {
    //localStorage.removeItem("fsjs");
    //console.log('!!!!! Local storage cleared. In development mode');
  } catch( e ) { }
  // hisrc
  $.responsive = {
    bandwidth: null,
    connectionTestResult: null,
    connectionKbps: null,
    connectionType: null,
    devicePixelRatio: null
  };
  $.responsive.defaults = {
    useTransparentGif: false,
    transparentGifSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAMz/AAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
    minKbpsForHighBandwidth: 300,
    speedTestUri: '?q=50K.jpg',
    speedTestKB: 50,
    speedTestExpireMinutes: 30,
    forcedBandwidth: false,
    srcIsLowResoltion: true
  };
  $.responsive.speedTest = function() {
    $(window).speedTest();
  };
  $.fn.speedTest = function (options){
    var settings = $.extend({
      callback: function() {}
    }, $.responsive.defaults, options),
      $els = $(this),

      // check bandwidth via @Modernizr's network-connection.js
      connection = navigator.connection || { type: 0 }, // polyfill

      isSlowConnection = connection.type == 3
                || connection.type == 4
                || /^[23]g$/.test(connection.type);

    // variables/functions below for speed test are taken from Foresight.js
    // Copyright (c) 2012 Adam Bradley
    // Licensed under the MIT license.
    // https://github.com/adamdbradley/foresight.js
    // Modified by Christopher Deutsch for hisrc.js
    var speedTestUri = settings.speedTestUri,
      STATUS_LOADING = 'loading',
      STATUS_COMPLETE = 'complete',
      STATUS_STARTED = 'started',
      LOCAL_STORAGE_KEY = 'fsjs', // may as well piggy-back on Forsight localstorage key since we're doing the same thing.
      speedConnectionStatus,

      initSpeedTest = function () {
        // only check the connection speed once, if there is a status then we've
        // already got info or it already started
        if ( speedConnectionStatus ) {
          return;
        }
        // If another test has started
        if(window.responsive_speed_test == STATUS_STARTED){
          return;
        }
        window.responsive_speed_test = 'started';
        // force that this device has a low or high bandwidth, used more so for debugging purposes
        if ( settings.forcedBandwidth ) {
          $.responsive.bandwidth = settings.forcedBandwidth;
          $.responsive.connectionTestResult = 'forced';
          speedConnectionStatus = STATUS_COMPLETE;
          $els.trigger('speedTestComplete.responsive');
          return;
        }
        // if the device pixel ratio is 1, then no need to do a network connection
        // speed test since it can't show hi-res anyways
        if ( $.responsive.devicePixelRatio === 1 ) {
          $.responsive.connectionTestResult = 'skip';
          speedConnectionStatus = STATUS_COMPLETE;
          $els.trigger('speedTestComplete.responsive');
          return;
        }

        // if we know the connection is 2g or 3g
        // don't even bother with the speed test, cuz its slow
        // Copyright (c) Faruk Ates, Paul Irish, Alex Sexton
        // Available under the BSD and MIT licenses: www.modernizr.com/license/
        // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/network-connection.js
        // Modified by Adam Bradley for Foresight.js
        $.responsive.connectionType = connection.type;
        if ( isSlowConnection ) {
          // we know this connection is slow, don't bother even doing a speed test
          $.responsive.connectionTestResult = 'connTypeSlow';
          speedConnectionStatus = STATUS_COMPLETE;
          $els.trigger('speedTestComplete.responsive');
          return;
        }

        // check if a speed test has recently been completed and its
        // results are saved in the local storage
        try {
          var fsData = JSON.parse( localStorage.getItem( LOCAL_STORAGE_KEY ) );
          if ( fsData !== null && fsData.bw !== null && fsData.kbps !== null) {

            if ( ( new Date() ).getTime() < fsData.exp ) {
              // already have connection data within our desired timeframe
              // use this recent data instead of starting another test
              $.responsive.bandwidth = fsData.bw;
              $.responsive.connectionKbps = fsData.kbps;
              $.responsive.connectionTestResult = 'localStorage';
              speedConnectionStatus = STATUS_COMPLETE;
              $els.trigger('speedTestComplete.responsive');
              return;
            }
          }
        } catch( e ) { }

        var
        speedTestImg = document.createElement( 'img' ),
        endTime,
        startTime,
        speedTestTimeoutMS;

        speedTestImg.onload = function () {
          // speed test image download completed
          // figure out how long it took and an estimated connection speed
          endTime = ( new Date() ).getTime();

          var duration = ( endTime - startTime ) / 1000;
          duration = ( duration > 1 ? duration : 1 ); // just to ensure we don't divide by 0

          $.responsive.connectionKbps = ( ( settings.speedTestKB * 1024 * 8 ) / duration ) / 1024;
          $.responsive.bandwidth = ( $.responsive.connectionKbps >= settings.minKbpsForHighBandwidth ? 'high' : 'low' );

          speedTestComplete( 'networkSuccess' );
        };

        speedTestImg.onerror = function () {
          // fallback incase there was an error downloading the speed test image
          speedTestComplete( 'networkError', 5 );
        };

        speedTestImg.onabort = function () {
          // fallback incase there was an abort during the speed test image
          speedTestComplete( 'networkAbort', 5 );
        };

        // begin the network connection speed test image download
        startTime = ( new Date() ).getTime();
        speedConnectionStatus = STATUS_LOADING;
        if ( document.location.protocol === 'https:' ) {
          // if this current document is SSL, make sure this speed test request
          // uses https so there are no ugly security warnings from the browser
          speedTestUri = speedTestUri.replace( 'http:', 'https:' );
        }
        speedTestImg.src = speedTestUri + "&r=" + Math.random();

        // calculate the maximum number of milliseconds it 'should' take to download an XX Kbps file
        // set a timeout so that if the speed test download takes too long
        // than it isn't a 'high-bandwidth' and ignore what the test image .onload has to say
        // this is used so we don't wait too long on a speed test response
        // Adding 350ms to account for TCP slow start, quickAndDirty === TRUE
        speedTestTimeoutMS = ( ( ( settings.speedTestKB * 8 ) / settings.minKbpsForHighBandwidth ) * 1000 ) + 350;
        setTimeout( function () {
          speedTestComplete( 'networkSlow' );
        }, speedTestTimeoutMS );
      },

      speedTestComplete = function ( connTestResult, expireMinutes ) {
        // if we haven't already gotten a speed connection status then save the info
        if (speedConnectionStatus === STATUS_COMPLETE) { return; }

        // first one with an answer wins
        speedConnectionStatus = STATUS_COMPLETE;
        $.responsive.connectionTestResult = connTestResult;

        try {
          if ( !expireMinutes ) {
            expireMinutes = settings.speedTestExpireMinutes;
          }
          var fsDataToSet = {
            kbps: $.responsive.connectionKbps,
            bw: $.responsive.bandwidth,
            exp: ( new Date() ).getTime() + (expireMinutes * 60000)
          };
          localStorage.setItem( LOCAL_STORAGE_KEY, JSON.stringify( fsDataToSet ) );
        } catch( e ) {}
        window.responsive_speed_test = 'ended';
        // trigger swap once speedtest is complete.
        $('img').trigger('speedTestComplete.responsive');
      }
      initSpeedTest();
  }
  $.responsive.speedTest(); // this runs the speed test as early as possible
  $.fn.responsiveImage = function(options){
    var settings = $.extend({
      callback: function() {}
    }, $.responsive.defaults, options),

      $els = $(this),

      // check bandwidth via @Modernizr's network-connection.js
      connection = navigator.connection || { type: 0 }, // polyfill

      isSlowConnection = connection.type == 3
                || connection.type == 4
                || /^[23]g$/.test(connection.type);

    // get pixel ratio
    $.responsive.devicePixelRatio = 1;
    if(window.devicePixelRatio !== undefined) {
      $.responsive.devicePixelRatio = window.devicePixelRatio;
    } else if (window.matchMedia !== undefined) {
      for (var i = 1; i <= 2; i += 0.5) {
        if (window.matchMedia('(min-resolution: ' + i + 'dppx)').matches) {
          $.responsive.devicePixelRatio = i;
        }
      }
    }
    setImageSource = function ( $el, imageToUse ) {
      if (settings.useTransparentGif) {
        $el.attr('src', settings.transparentGifSrc)
          .css('max-height', '100%')
          .css('max-width', '100%')
          .css('background', 'url("' + imageToUse.src + '") no-repeat 0 0')
          .css('background-size', 'contain');
      } else {
        $el.attr('src', imageToUse.src);
        $el.attr('width', imageToUse.wrapperWidth);
        $el.attr('data-width', imageToUse.key);
      }
    };
    getImageToUse = function ($el, mode) {
      if ($.responsive.devicePixelRatio > 1 && $.responsive.bandwidth === 'high' && typeof(mode) === "undefined"){
        mode = 2;
      }else if(typeof(mode) === "undefined"){
        mode = 1
      }
      wrapperWidth = $el.parents('.response-image-container').width();
      imageWidth = wrapperWidth * mode;
      var srcset = $el.data('srcset'); // set of images that can be used
      if(typeof srcset === 'undefined'){
        return;
      }
      var currentWidth = 0; // width of image to use
      var imageToUse = new Object(); // Keeps src to image
      $.each(srcset, function(key, value) {
        if(parseInt(key) > parseInt(currentWidth) &&
          (currentWidth == 0 || (parseInt(currentWidth) < parseInt(imageWidth) && parseInt(key) > parseInt(currentWidth)))){
          currentWidth = key;
          imageToUse.src = value;
          imageToUse.key = key;
          imageToUse.wrapperWidth = wrapperWidth;
        }
      });
      return imageToUse;
    };

    // loop throu all images on page
    $els.each(function(){
      var $el = $(this);
      var imageToUse = getImageToUse($el);
      if(typeof imageToUse !== 'undefined'){
        setImageSource($el, imageToUse);
      }
      $el.on('speedTestComplete.responsive', function(){
        // If the speedtest is completed after the image is set, change the image
        // to a 'retina' image if device supports it and the bandwidth is wide enough
        if ($.responsive.devicePixelRatio > 1 && $.responsive.bandwidth === 'high') {
          var imageToUse = getImageToUse($el, 2);
        }else{
          var imageToUse = getImageToUse($el);
        }
        // if image is found and is different from current
        if(typeof imageToUse !== 'undefined'){
          if(imageToUse.src != $el.attr('src')){
            setImageSource($el, imageToUse);
          }
        }
        $el.off('speedTestComplete.responsive');
      });
      $el.on('recheckImage.responsive', function(){
        // A recheck function to use to check if the correct image is in use.
        // Nice to use if the element the image is residing in is resized.
        imageToUse = getImageToUse($(this));
        if(typeof imageToUse !== 'undefined'){
          if(imageToUse.src != $el.attr('src')){
            setImageSource($el, imageToUse);
          }
        }
      });
    });
    return $els;
  }
  Drupal.behaviors.hkimages = {
    attach: function (context, settings) {
      $(".response-image-container img", context).responsiveImage();
      $(".response-image-container img", context).bind("resize.responsiveImage", function(e){
        $(this).trigger('recheckImage.responsive');
      });
    }
  }
}(jQuery, Drupal));

