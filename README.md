# angular-eha.retriable

[![Build Status](https://travis-ci.org/eHealthAfrica/retriable.svg)](https://travis-ci.org/eHealthAfrica/retriable) ![Dependecy Status](https://david-dm.org/eHealthAfrica/retriable.svg) ![Dev Dependecy Status](https://david-dm.org/eHealthAfrica/retriable/dev-status.svg)

# Warning: WIP

![Under construction](https://jsbin-user-assets.s3.amazonaws.com/rem/graphics-under-construction-878725.gif)

## Usage

If you're using wiredep, then all you need to do is add `eha.retriable` as an angular module dependency somewhere sensible in your app. In the absense of wiredep, you'll need to manually bundle `dist/retriable.js`.

### Configuration

The module can be configured through the `ehaRetriableProvider` via a config block.

The `setNotice` will be used when a `401` is returned to inform the user that there's a login failure (whereby retriable will *retry* to log them in). The callback for `setNotice` can be synchronous or asynchronous.

#### Synchronous configuration

```js
app.config(function(ehaRetriableProvider) {
  ehaRetriableProvider.setNotice(function () {
    growl.error('Failed to login');
  });
});
```
#### Asynchronous configuration

```js
app.config(function(ehaRetriableProvider) {
  ehaRetriableProvider.setNotice(function () {
    var deferred = $q.defer();

    // contrived example
    requestAnimationFrame(function () {
      // show the user a sweet alert
      swal({
        text: "The auto sign in failed, do you want to keep trying?",
        type: "warning",
        showCancelButton: true
      }, function(confirmed){
        if (isConfirm) {
          deferred.resolve();
        } else {
          deferred.reject(new Error('User cancelled'));
        }
      });
    });

    return deferred.promise;
  });
});
```

## ehaRetriable

### `ehaRetriable(workflow)`

`workflow` is the callback you want to run through once a connection has been secured.
The workflow *should* return a promise.

**n.b. The result is a retriable *function* that can be re-used throughout your code.**

The retriable function (result from `ehaRetriable`) returns a Promise/A+ object.

Any arguments you pass into the retriable will be passed into the workflow.

### Catching errors in workflows

Sometimes its nice to catch errors in workflows, for example if a workflow tries to GET a document, and it's not found,
we might wanna PUT it anyway. When doing this, make sure to propagate any errors except the specific ones you want to catch,
otherwise the retriable wont work.


```js
  var getAndSave = ehaRetriable(function(doc) {
    return myDB.get(doc._id)
      .catch(function(err) {
        // If the doc is not found, ignore that,
        if(err.status === 404) {
          return {};
        }
        // All other errors are propagated
        return $q.reject(err);
      })
      .then(function(existingDoc) {
        if(exisitingDoc._rev) {
          doc._rev = existingDoc._rev;
        }

        return myDB.put(doc);
      });
  });
```

## Installation

Install with npm:

    npm install --save angular-eha.retriable

Or alternatively bower:

    bower install --save angular-eha.retriable

### Distribution bundle

- *dist/retriable.js*
- *dist/retriable.min.js*


Then simply add `eha.retriable` as dependencies somewhere in your project that makes sense and you're good to go.

#### A note on wiredep

If you're using wiredep `dist/retriable.js` will be injected by default. If you don't want that to happen you'll like want to employ something along the following lines in your `Gruntfile`:

```javascript
wiredep: {
 ...
  options: {
    exclude: [
      'bower_components/retriable/dist/retriable.js'
    ]
  }
  ...
}
```

Then you're free to include whichever bundle you prefer in what ever manner you prefer.

### Example

```js
angular.module('eha.myApp')
  .config(function (ehaRetriableProvider) {
    ehaRetriableProvider.setNotice(function () {
      // this is an example of a synchronous notice, where the user
      // isn't required to input.
      growl.error(gettextCatalog.getString('Login failed.'));

      // if you need the user to do something, make sure to return
      // a promise instead, and retriable will wait for the promise
      // to resolve or reject.
    });
  })
  .service('idService', function(
    ehaRetriable
  ) {
    // ...
    // before hitting the database to get some values, first try
    // to reconnect to the database and re-auth if neccessary
    var getNewIds = ehaRetriable(function() {
      return $http({
        url: someUrl,
        method: 'GET',
        params: { limit: ids },
        withCredentials: true
      }).then(function(response) {
        return utility.pluck(response.data, 'id');
      })
      .then(storeNewIds);
    });

    // ... later

    // invoke the getNewIds request
    getNewIds().then(function () {
      // do something
    });
  });
```

## Contributing

### Prerequisites

- Firefox (for running test suite)
- node (0.12.0)
- bower (1.3.12)
- grunt-cli (0.1.7)
- grunt (0.4.5)

### Installation

```bash
# Fork the upstream repo on github and pull down your fork
git clone git@github.com:eHealthAfrica/angular-eha.retriable.git
# change into project folder
cd angular-eha.retriable
# Install the dev dependencies
npm install
```

### Docs

Code should be documented following the guidelines set out by [jsdoc](http://usejsdoc.org/) and [ngdoc](https://github.com/angular/angular.js/wiki/Writing-AngularJS-Documentation). We can then leverage [Dgeni](http://github.com/angular/dgeni) or something simlary to generate documentation in any format we like.

### Test Suite

The test suite is configured to run in Firefox and is powered by:

- Karma
- Mocha
- Chai (as promised)
- Sinon (chai)

The library is conducive to TDD. `grunt test:watch` is your friend. As modules (and templates) are exposed on their own namespace you can easily isolate areas of the code base for true unit testing without being forced to pull in the whole library or stub/mock modules irrelevant to the feature(s) you're testing.

#### Running Tests

##### Single run

```bash
grunt test
```

##### Watch

```bash
grunt test:watch
```

### Local Development

Local development is made easy, simply make use of either `npm link` or `bower link` to link the local component to your client application and then use `grunt watch` to continuously build the project.

## Release Process

To make a release, ensure you have issued `grunt build`, committed the distribution package and tagged the commit with an appropriate version according to the [SemVer spec](http://semver.org/).

To make this easy for you, there's a handy grunt task. Simply issue `grunt release:major|minor|patch` and grunt will take care of building, committing and tagging for you. Then make a PR to the master branch of the upstream, merge upon CI build success and then all that's left to do is to push the tags to the upstream.

e.g:

```bash
  grunt release:minor
  git pull-request -b <upstream_repo>:master
  git push upstream --tags
```

### Publishing to npm

To publish a new version to npm, simply issue from the command line prior making a release (i.e.issuing a `grunt release` and pushing both commits and tags to the upstream):

```
npm publish
```

### Publishing to bower

Publishing to bower is slightly simpler in so far that you only have to do it once, and not explicitly for every release like npm:

e.g.

```
bower register angular-eha.retriable <upstream_repo_url>
```
## License

Copyright 2015 Remy Sharp <remy@remysharp.com>

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the License for the specific language governing permissions and limitations under the License.
