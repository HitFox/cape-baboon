//import testing utilities
var tap = require('tap');
var nock = require('nock');

//import our module itself
var CapeBaboon = require('../src/cape-baboon');

//Disable real network requests because that could get out of hand quickly.
nock.disableNetConnect();

//The basic request check to make sure we can make a good set of requests
tap.test('baboon.request tests', function (test) {
  var baboon = new CapeBaboon();
  test.plan(2);
  //Good health server, fail on second connection
  nock('http://www.example.com')
    .get('/good-health')
    .reply(200, 'OK')
    .get('/good-health')
    .reply(503, 'Service Unavailable');

  //A request to the good health server to make sure we are making the request
  var requestOptionsGoodHealth = {
    uri: 'http://www.example.com/good-health'
  };

  baboon.request(requestOptionsGoodHealth)
    .then(function () {
      test.pass('Successful HTTP status received from a server in good health 1');
    })
    .catch(function (err) {
      test.fail('Unsuccessful HTTP status received from a server in good health 1');
    });
  baboon.request(requestOptionsGoodHealth)
    .then(function () {
      test.fail('Successful HTTP status received from a server in good health 2');
    })
    .catch(function (err) {
      test.pass('Unsuccessful HTTP status received from a server in good health 2');
    });
});

//Retry on failure with catch block hit first, then retry.
tap.test('baboon.requests retry on failure tests', function (test) {
  var baboon = new CapeBaboon({RETRY_FAILED: true, RETRY_TIMEOUT: 10, LOGGER: function () {}});
  test.plan(1);
  nock('http://www.example.com')
    .get('/retry-on-failure')
    .reply(503, 'Service Unavailable')
    .get('/retry-on-failure')
    .reply(200, 'OK');

  var requestOptionsRetryOnFailure = {
    uri: 'http://www.example.com/retry-on-failure'
  }

  baboon.request(requestOptionsRetryOnFailure)
    .then(function () {
      test.pass('Single failed request should lead to a resolved promise after a successful request');
    })
    .catch(function (err) {
      test.fail(err);
    });
});

tap.test('baboon.requests retry on error tests', function (test) {
  var baboon = new CapeBaboon({RETRY_ERROR: true, RETRY_TIMEOUT: 10, LOGGER: function () {}});
  test.plan(1);
  nock('http://www.example.com')
    .get('/reply-with-error')
    .replyWithError('ENOTFOUND')
    .get('/reply-with-error')
    .reply(200, 'OK');

  var requestOptionsReplyWithError = {
    uri: 'http://www.example.com/reply-with-error'
  }

  baboon.request(requestOptionsReplyWithError)
    .then(function () {
      test.fail('promise should not be resolved');
    })
    .catch(function (err) {
      test.pass('Error should be caught');
    });
});

tap.test('baboon.requests retry on error set to false', function (test) {
  var baboon = new CapeBaboon({RETRY_ERROR: false, RETRY_TIMEOUT: 10, LOGGER: function () {}});
  test.plan(1);

  var requestOptionsReplyWithError = {
    uri: 'sdfghjk'
  }

  baboon.request(requestOptionsReplyWithError)
    .then(function () {
      test.fail('promise should not be resolved');
    })
    .catch(function (err) {
      test.pass('Error should be caught');
    });
});
