;(function() {
  'use strict';
  // , growl, gettextCatalog
  var ngModule = angular.module('eha.retriable');

  ngModule.provider('retriable', function($q, loginService) {
    // the notification is a passthrough promise to start with
    var notice401 = $q.defer().resolve;

    this.setNotice = function(fn) {
      var defer = $q.defer();

      // this allows our notify callback to be either sync or a promise
      return defer.resolve(fn());
    };

    function Retriable(workflow) {
      var args = arguments;
      var ret = $q.defer();

      function flow() {
        return workflow.apply(null, args);
      }

      function resolve() {
        ret.resolve.apply(ret, arguments);
      }

      function reject() {
        ret.reject.apply(ret, arguments);
      }

      function reject401(err) {
        // Note here that a request sent w/ only
        // username and no password returns 400
        // But hopefully, the login service should
        // prevent that
        if (err.status !== 401) {
          return reject(err);
        }

        // retry of existing credentials failed, ask for new ones
        return notice401()
          .then(loginService.logout)
          .then(loginService.maybeShowLoginUi)
          .then(loginService.renew)
          .then(flow)
          .then(resolve)
          .catch(reject);
      }

      var firstTry = loginService.maybeShowLoginUi().then(flow);

      firstTry.then(resolve);
      firstTry.catch(function(err) {
        // not auth error, let the error propagate
        if (err.status !== 401) {
          return reject(err);
        }

        // retry an auth error:
        var renewal = loginService.renew();
        renewal.catch(reject401);

        renewal
          .then(flow)
          .then(resolve)
          // Catch bad login for this specific flow
          .catch(reject401);
      });

      return ret.promise;
    };

    this.$get = function(workflow) {
      return new Retriable(workflow);
    };
  });

  // Check for and export to commonjs environment
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ngModule;
  }

})();
