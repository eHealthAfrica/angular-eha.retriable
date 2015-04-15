(function() {
  'use strict';

  /* globals assert*/

  var $q;
  var retriable;
  var retriableProvider;
  var loginService;

  var error401 = {
    status: 401,
    message: 'Name or password is incorrect',
  };

  var noopPromise = function() {};

  function digestIt(original) {
    return function(description, testFn) {
      var isAsync = testFn.length >= 1;
      var fn = !isAsync ? testFn : function(done) {
        testFn(done);
        inject(function($rootScope) {
          $rootScope.$digest();
        });
      };
      original(description, fn);
    };
  }

  // test helper/override thing
  it = digestIt(it); // jshint ignore:line

  // mock the loginService
  beforeEach(module('eha.retriable', function($provide) {
    var mockLoginService = {};
    mockLoginService.logout = noopPromise;
    mockLoginService.maybeShowLoginUi = noopPromise;
    mockLoginService.renew = noopPromise;
    $provide.value('loginService', mockLoginService);
  }));

  beforeEach(module(function(_retriableProvider_) {
    retriableProvider = _retriableProvider_;
  }));

  describe('Retriable Workflows', function() {
    beforeEach(inject(function(_retriable_, _loginService_, _$q_) {
      retriable = _retriable_;
      $q = _$q_;
      loginService = _loginService_;

      // hook spies onto loginService
      sinon.stub(loginService, 'logout').returns($q.when({}));
      sinon.stub(loginService, 'maybeShowLoginUi').returns($q.when({}));
      sinon.stub(loginService, 'renew').returns($q.when({}));
    }));

    it('should expose a method', function() {
      assert.isDefined(retriable);
    });

    it('should be a promise', function() {
      var flow = retriable(function() {});
      assert.isDefined(flow().then);
    });

    it('should be configurable', function() {
      assert.isDefined(retriableProvider.setNotice);
    });

    it('should execute the workflow, after possibly showing login ui',
      function(done) {
      var flowSpy = sinon.spy();

      // This is how a flow should be, call retriable with a function as arg
      // that function should return a promise
      var flow = retriable(function() {
        flowSpy();
        return $q.when({result: true});
      });

      flow().then(function(res) {
        expect(loginService.maybeShowLoginUi.called);
        expect(flowSpy.called);
        expect(res.result).to.equal(true);
        done();
      });
    });

    it('should retry the login creds, if the flow fails with a 401',
      function(done) {
      var flowSpy = sinon.spy(function() {
        // accept when we have renewed the session
        if (loginService.renew.called) {
          return $q.when({result: true});
        }

        return $q.reject(error401);
      });

      var flow = retriable(function() {
        return flowSpy();
      });

      flow().then(function(res) {
        expect(flowSpy.callCount).to.equal(2);
        expect(loginService.renew.called);
        expect(res.result).to.equal(true);
        done();
      });
    });

    it('should show the login dialog again, if renewal fails with 401',
      function(done) {
      var hasEnteredNewCredentials = function() {
        return loginService.logout.called &&
               loginService.maybeShowLoginUi.called;
      };

      // Setup up workflow, return ok if user have entered new creds,
      // otherwise, fail
      var flowSpy = sinon.spy(function() {
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
      loginService.renew = sinon.spy(function() {
        if (hasEnteredNewCredentials()) {
          return $q.when({});
        }
        // Fail before that happened
        return $q.reject(error401);
      });

      flow().then(function(res) {
        expect(flowSpy.callCount).to.equal(3);
        expect(loginService.logout.called);
        expect(loginService.renew.callCount).to.equal(3);
        expect(res.result).to.equal(true);
        done();
      });
    });

    it('should propagate non-401 errors to the outside', function(done) {
      // Failing workflow, error not connected
      var flowSpy = sinon.spy(function() {
        var randomDBError = {
          'status': 405,
          'name': 'unknown_error',
          'message': 'Database encountered an unknown error',
          'error': true,
          'statusText':'Method Not Allowed',
        };

        return $q.reject(randomDBError);
      });

      var flow = retriable(function() {
        return flowSpy();
      });

      flow().catch(function(err) {
        expect(flowSpy.called);
        // aborted because of non-401 error
        expect(loginService.renew.notCalled);

        // should propagate errors
        expect(err.status).to.equal(405);

        done();
      });
    });

    it('should cancel workflow, if user hits "cancel" button on login dialog',
      function(done) {
      // setup 'cancel' click
      loginService.maybeShowLoginUi.returns($q.reject('cancelled'));

      var flowSpy = sinon.stub().returns($q.when({result: true}));

      var flow = retriable(function() {
        return flowSpy();
      });

      flow().catch(function(res) {
        expect(loginService.maybeShowLoginUi.called);
        // should have cancelled flow
        expect(flowSpy.notCalled);
        // resp from login dialog
        expect(res).to.equal('cancelled');
        done();
      });
    });

    it('should allow for custom notification', function(done) {
      loginService.maybeShowLoginUi.returns($q.reject('cancelled'));

      var flowSpy = sinon.stub().returns($q.when({result: true}));

      var flow = retriable(function() {
        return flowSpy();
      });

      flow().catch(function(res) {
        expect(loginService.maybeShowLoginUi.called);
        // should have cancelled flow
        expect(flowSpy.notCalled);
        // resp from login dialog
        expect(res).to.equal('cancelled');

        done();
      });
    });
  });

  describe('Retriable provider is configurable', function() {
    it('should support synchronous notification', function(done) {
      var spy = sinon.spy(function() {
        return true;
      });
      assert.isDefined(retriableProvider.setNotice);
      retriableProvider.setNotice(spy);

      inject(function(_retriable_, _loginService_, _$q_) {
        retriable = _retriable_;
        $q = _$q_;
        loginService = _loginService_;

        // hook spies onto loginService
        sinon.stub(loginService, 'logout').returns($q.when({}));
        sinon.stub(loginService, 'maybeShowLoginUi').returns($q.when({}));
        sinon.stub(loginService, 'renew').returns($q.when({}));

        var flowSpy = sinon.spy(function() {
          // accept when we have renewed the session
          if (loginService.renew.called) {
            return $q.when({result: true});
          }

          return $q.reject(error401);
        });

        var flow = retriable(function() {
          return flowSpy();
        });

        flow().then(function(res) {
          expect(flowSpy.callCount).to.equal(2);
          expect(loginService.renew.called);
          expect(spy.called);
          expect(res.result).to.equal(true);
          done();
        });
      });
    });

    it('should support async notification', function(done) {
      var innerSpy = sinon.spy();
      var spy = sinon.spy(function() {
        var deferred = $q.defer();
        setTimeout(function() {
          console.log('calling');
          innerSpy();
          deferred.resolve(true);
        }, 1000);

        return deferred.promise;
      });

      assert.isDefined(retriableProvider.setNotice);
      retriableProvider.setNotice(spy);

      inject(function(_retriable_, _loginService_, _$q_) {
        retriable = _retriable_;
        $q = _$q_;
        loginService = _loginService_;

        // hook spies onto loginService
        sinon.stub(loginService, 'logout').returns($q.when({}));
        sinon.stub(loginService, 'maybeShowLoginUi').returns($q.when({}));
        sinon.stub(loginService, 'renew').returns($q.when({}));

        var flowSpy = sinon.spy(function() {
          // accept when we have renewed the session
          if (loginService.renew.called) {
            return $q.when({result: true});
          }

          return $q.reject(error401);
        });

        var flow = retriable(function() {
          return flowSpy();
        });

        flow().then(function(res) {
          expect(flowSpy.callCount).to.equal(2);
          expect(loginService.renew.called);
          expect(spy.called);
          expect(innerSpy.callCount).to.equal(1);
          expect(res.result).to.equal(true);
          done();
        });
      });
    });
  });
})();
