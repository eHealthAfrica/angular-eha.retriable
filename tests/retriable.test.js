'use strict';

/*
 * Retriable remote couch workflows
 *
 * set up a workflow that returns a promise,
 * the 'retriable' service does all the work of
 * showing login ui, trying to renew session,
 * and if that fails, show ui again
 *
 * see app/scripts/services/retriable for more info
 */
describe('Retriable Workflows', function() {

  module(function($provide) {
    $provide.service('loginService', function($q) {
      this.logout = jasmine.createSpy('logout').andCallFake(function() {
        return $q.resolve();
      });

      this.maybeShowLoginUi = jasmine.createSpy('maybeShowLoginUi')
        .andCallFake(function() {
        return $q.resolve();
      });

      this.renew = jasmine.createSpy('renew').andCallFake(function() {
        return $q.resolve();
      });
    });
  });

  // load templates
  // beforeEach(module('eha.templates'));

  // beforeEach(module('eha.biometricregistration', function($provide) {
  //   // see spec/services/contact-service about this
  //   $provide.value('$state', {
  //     go: jasmine.createSpy('state go')
  //   });
  // }));

  var $q;
  var retriable;
  var loginService;
  var error401 = {status: 401, message: 'Name or password is incorrect'};
  beforeEach(inject(function(_loginService_, _$q_, _retriable_) {
    $q = _$q_;
    retriable = _retriable_;
    loginService = _loginService_;

    // Stub out all the necessary loginService methods
    spyOn(loginService, 'logout').andReturn($q.when({}));
    spyOn(loginService, 'maybeShowLoginUi').andReturn($q.when({}));
    spyOn(loginService, 'renew').andReturn($q.when({}));
  }));

  it('should execute the workflow, after possibly showing login ui', function() {
    var flowSpy = jasmine.createSpy('workflow');

    // This is how a flow should be, call retriable with a function as arg
    // that function should return a promise
    var flow = retriable(function() {
      flowSpy();
      return $q.when({result: true});
    });

    runs(function() {
      return flow()
        .then(function(res) {
          expect(loginService.maybeShowLoginUi).toHaveBeenCalled();
          expect(flowSpy).toHaveBeenCalled();
          expect(res.result).toEqual(true);
        });
    });
  });

  it('should retry the login creds, if the flow fails with a 401', function() {
    var flowSpy = jasmine.createSpy('workflow').andCallFake(function() {
      // accept when we have renewed the session
      if (loginService.renew.wasCalled) {
        return $q.when({result: true});
      }

      return $q.reject(error401);
    });

    var flow = retriable(function() {
      return flowSpy();
    });

    runs(function() {
      return flow()
        .then(function(res) {
          expect(flowSpy.callCount).toEqual(2);
          expect(loginService.renew).toHaveBeenCalled();
          expect(res.result).toEqual(true);
        });
    });
  });

  it('should show the login dialog again, if renewal fails with 401', function() {
    var hasEnteredNewCredentials = function() {
      return loginService.logout.wasCalled &&
             loginService.maybeShowLoginUi.wasCalled;
    };

    // Setup up workflow, return ok if user have entered new creds,
    // otherwise, fail
    var flowSpy = jasmine.createSpy('workflow').andCallFake(function() {
      if (hasEnteredNewCredentials()) {
        return $q.when({result: true});
      }

      return $q.reject(error401);
    });

    var flow = retriable(function() {
      return flowSpy();
    });

    // Set up the login service
    // Let it through when creds was wiped and entered again
    loginService.renew.andCallFake(function() {
      if (hasEnteredNewCredentials()) {
        return $q.when({});
      }
      // Fail before that happened
      return $q.reject(error401);
    });

    runs(function() {
      return flow()
        .then(function(res) {
          expect(flowSpy.callCount).toEqual(3);
          expect(loginService.logout).toHaveBeenCalled();
          expect(loginService.renew.callCount).toEqual(3);
          expect(res.result).toEqual(true);
        });
    });
  });

  it('should propagate non-401 errors to the outside', function() {
    // Failing workflow, error not connected
    var flowSpy = jasmine.createSpy('workflow').andCallFake(function() {
      var randomDBError = {'status':405, 'name':'unknown_error', 'message':'Database encountered an unknown error', 'error':true, 'statusText':'Method Not Allowed'};
      return $q.reject(randomDBError);
    });

    var flow = retriable(function() {
      return flowSpy();
    });

    runs(function() {
      return flow()
        .catch(function(err) {
          expect(flowSpy).toHaveBeenCalled();
          // aborted because of non-401 error
          expect(loginService.renew).not.toHaveBeenCalled();

          // should propagate errors
          expect(err.status).toEqual(405);
        });
    });
  });

  it('should cancel workflow, if user hits ui "cancel" button on login dialog', function() {
    // setup 'cancel' click
    loginService.maybeShowLoginUi.andReturn($q.reject('cancelled'));

    var flowSpy = jasmine.createSpy('workflow').andReturn($q.when({result: true}));
    var flow = retriable(function() {
      return flowSpy();
    });

    runs(function() {
      return flow()
        .catch(function(res) {
          expect(loginService.maybeShowLoginUi).toHaveBeenCalled();
          // should have cancelled flow
          expect(flowSpy).not.toHaveBeenCalled();
          // resp from login dialog
          expect(res).toEqual('cancelled');
        });
    });
  });
});
