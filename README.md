# cape-baboon
The cape baboon is a node module for mass requests to helpless enemy servers.
![Baboons with Car](http://i.dailymail.co.uk/i/pix/2009/07/20/article-1200917-05C68C79000005DC-619_634x399.jpg)

It throttles requests and retries them until they are completed regardless of limits and restrictions of the enemy server.

## Configuration
You can configure every baboon queue with initializing it with a options object.
All the options are, as you might have guessed, optional.
This is the standard configuration:
```javascript
var options = {
  RETRY_TIMEOUT     = 1000,         // the time to wait for retrying a request
  LIMIT_PER_SECOND  = 10,           // how many requests are available per second.
                                    // rule of thumb: 4.0 * 1000/LIMIT_PER_SECOND
  SLOT_RESPAWN      = 4000,         // Time in miliseconds for respawning the slots
  TOO_MANY_REQUESTS = 429,          // The reutrn Status from the Server if there are too many request sent to it. If applicable.
  INFLIGHT          = 'inflight',   // Status while the request call is active
  FULFILLED         = 'fulfilled',  // Status when the request was successfull
  THROTTLED         = 'throttled',  // Status when the request gets throttled
  ERRORED           = 'errored',    // Status when the request has thrown an internal error
  RETRY_ERRORED     = false,        // whether to retry a request if it throws an internal error or not
  RETRY_FAILED      = false,        // whether to retry a request if it returns an http error code
  // Logger function
  LOGGER            = function(text){console.log(text);}
};
```

## How it works
![How it works](http://i.giphy.com/pFwRzOLfuGHok.gif)

### require
```javascript
var CapeBaboon = require('cape-baboon');
```
### creating a queue
with standard configuration:
```javascript
var baboon = new CapeBaboon();
```
with own config:
```javascript
var baboon = new CapeBaboon({
  RETRY_TIMEOUT     = 1000,
  LIMIT_PER_SECOND  = 10
});
```
### enqueue
There are two ways of enqueueing a request.
1. The first way is creating a wrapper function for the call and the pushing it to the queue:
```javascript
var requestCall = function(){
  return Request('http://www.google.de')
};

baboon.push(requestCall);
```
2. The second way is using the more handy build in request method:
```javascript
var requestOptions = {
  uri: 'http://www.google.de'
};
baboon.request(requestOptions);
```
    The Cape baboon uses the request-promise node-module.
    Please refer to: [request-promise](https://www.npmjs.com/package/request-promise) for documentation.

## Examples
```javascript
var CapeBaboon = require('./../src/cape-baboon');
var Request = require('request-promise');

// use standard options
var options = {};

// init CapeBaboon Queue
var baboon = new CapeBaboon(options);

// define request call
var requestCall = function(){
  return Request('http://www.google.de')
};

// give the request call to the baboon
baboon.push(requestCall);

// push returns a promise so you can chain it. the result is the result fromt the request call
baboon.push(requestCall)
        .then(function(result){
                console.log(result);
              }
        );

// the more handy way of request abstraction.
// the request are build with the request-promise module. View https://www.npmjs.com/package/request-promise for documentation
var requestOptions = {
  uri: 'http://www.google.de'
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
```

## Thanks
The original module is written by [@agento](https://github.com/janv)
