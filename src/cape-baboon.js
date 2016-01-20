'use strict';

var _ = require('lodash');
var R = require('request-promise');
var P = require("bluebird");

var RETRY_TIMEOUT     = 0;          // the time to wait for retrying a request
var LIMIT_PER_SECOND  = 0;          // how many requests are available per second
var SLOT_RESPAWN      = 0;          // Time in miliseconds for respawning the slots
var TOO_MANY_REQUESTS = 0;          // The return Status from the Server if there are too many request sent to it. If applicable.
var INFLIGHT          = 'not set';  // Status while the request call is active
var FULFILLED         = 'not set';  // Status when the request was successfull
var THROTTLED         = 'not set';  // Status when the request gets throttled
var ERRORED           = 'not set';  // Status when the request has thrown an internal error
var RETRY_ERRORED     = false;      // whether to retry a request if it throws an internal error or not
var RETRY_FAILED      = false;      // whether to retry a request if it returns an http error code
var LOGGER            = null        // Logger function

function CapeBaboon(options) {
  options = options || {};
  RETRY_TIMEOUT     = options.RETRY_TIMEOUT     || 1000;
  LIMIT_PER_SECOND  = options.LIMIT_PER_SECOND  || 10;
  SLOT_RESPAWN      = options.SLOT_RESPAWN      || 4.0 * 1000/LIMIT_PER_SECOND;
  TOO_MANY_REQUESTS = options.TOO_MANY_REQUESTS || 429;
  INFLIGHT          = options.INFLIGHT          || 'inflight';
  FULFILLED         = options.FULFILLED         || 'fulfilled';
  THROTTLED         = options.THROTTLED         || 'throttled';
  ERRORED           = options.FAILED            || 'errored';
  RETRY_FAILED      = options.RETRY_FAILED      || false;
  RETRY_ERRORED     = options.RETRY_ERRORED     || false;
  LOGGER            = options.LOGGER            || function(text){console.log(text);};
  this._pending     = [];
  this._inflight    = [];
  this._reset();
}

CapeBaboon.prototype.push = function (call) {
  var self = this;
  var promise = new P(function(resolve, reject){
    var requestObject = {
      call: call,
      resolve: resolve,
      reject: reject,
      status: null,
      throttle: function(){
        this.status = THROTTLED;
        self._proceed();
      }
    };
    self._pending.push(requestObject);
  });
  this._proceed();
  return promise;
};

CapeBaboon.prototype.request = function(options) {
  var call = function(){
    return R(options)
  };
  return this.push(call);
};

CapeBaboon.prototype._proceed = function(){
  this._removeFulfilled();
  this._removeThrottled();
  this._startPending();
};

CapeBaboon.prototype._removeFulfilled = function(){
  _.remove(this._inflight, {status: FULFILLED});
};

CapeBaboon.prototype._removeThrottled = function(){
  var throttled = _.remove(this._inflight, {status: THROTTLED});
  if (throttled.length > 0) this._retry(throttled);
};

CapeBaboon.prototype._retry = function(requests){
  var self = this;
  this._pending.unshift.apply(this._pending, requests);
  this._retryTimeout = setTimeout(function(){
    self._reset();
    self._proceed();
  }, RETRY_TIMEOUT);
  self._numSlots = 0;
};


CapeBaboon.prototype._startPending = function(){
  var self = this;
  var startRequests = Math.min(this._numSlots, this._pending.length);

  _.times(startRequests, function () {
    var request = self._pending.shift();
    request.status = INFLIGHT;
    try {
      request.call()
      .then(successHandler, errorHandler);
    } catch (e){
      //when the synchronous call() fails
      //should never happen unless _performRequest throws
      //TODO not quite happy with this. I want this to appear in the
      //     console with the original stacktrace (call to adapter.request)
      if(RETRY_ERRORED){
        LOGGER('ERROR THROTTLED', e);
        request.status = THROTTLED;
        self._proceed();
      }else{
        request.status = ERRORED;
        request.reject(e);
      }
      return;
    }
    self._takeSlot();
    self._inflight.push(request);

    function successHandler(result){
      if (result.status === TOO_MANY_REQUESTS) {
        LOGGER('MESSAGE THROTTLED');
        request.status = THROTTLED;
      } else {
        request.status = FULFILLED;
        request.resolve(result);
      }
      self._proceed();
    }

    function errorHandler(error){
      if(RETRY_FAILED){
        LOGGER('FAIL THROTTLED');
        request.status = THROTTLED;
      }else{
        request.status = FULFILLED;
        request.reject(error);
      }
      self._proceed();
    }
  });
};

CapeBaboon.prototype._takeSlot = function(){
  if (this._numSlots > 0) {
    this._numSlots--;
    setTimeout(respawnSlot, SLOT_RESPAWN);
  } else {
    throw new Error('No slots available');
  }

  var self = this;
  function respawnSlot(){
    if (self._isWaitingForRetry()) return;
    if (self._numSlots < LIMIT_PER_SECOND) {
      self._numSlots++;
      self._proceed();
    }
  }
};

CapeBaboon.prototype._reset = function(){
  this._numSlots = LIMIT_PER_SECOND;
  this._retryTimeout = null;
};

CapeBaboon.prototype._isWaitingForRetry = function(){
  return this._retryTimeout !== null && this._retryTimeout !== undefined;
};

module.exports = CapeBaboon;
