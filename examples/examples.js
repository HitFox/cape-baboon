'use strict';
var CapeBaboon = require('./../src/cape-baboon');
var Request = require('request-promise');

// use standard options
var options = {};

// init CapeBaboon Queue
const baboon = new CapeBaboon(options);

// define request call
var requestCall = function () {
  return Request('http://www.google.de');
};

// give the request call to the baboon
baboon.push(requestCall);

// push returns a promise so you can chain it. the result is the result from the request call
baboon.push(requestCall)
        .then(function (result) {
                console.log(result);
              }
        );

// the more handy way of request abstraction.
// the request are build with the request-promise module.
// View https://www.npmjs.com/package/request-promise for documentation
var requestOptions = {
  uri: 'http://www.google.de',
};

// .request fires the request-promise method wrapped in a request call function
baboon.request(requestOptions);

// with promise chain
baboon.request(requestOptions)
    .then(function (htmlString) {
      // Process html...
    })
    .catch(function (err) {
      // Crawling failed...
    });
