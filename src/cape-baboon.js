'use strict';

var _ = require('lodash');
var R = require('request-promise');
var P = require("bluebird");

function CapeBaboon(options) {
  options = options || {};
  this.RETRY_TIMEOUT     = options.RETRY_TIMEOUT     || 1000;                         // the time to wait for retrying a request
  this.LIMIT_PER_SECOND  = options.LIMIT_PER_SECOND  || 10;                           // the time to wait for retrying a request
  this.SLOT_RESPAWN      = options.SLOT_RESPAWN      || 4.0 * 1000/LIMIT_PER_SECOND;  // Time in miliseconds for respawning the slots
  this.TOO_MANY_REQUESTS = options.TOO_MANY_REQUESTS || 429;                          // The return Status from the Server if there are too many request sent to it. If applicable.
  this.INFLIGHT          = options.INFLIGHT          || 'inflight';                   // Status while the request call is active
  this.FULFILLED         = options.FULFILLED         || 'fulfilled';                  // Status when the request was successfull
  this.THROTTLED         = options.THROTTLED         || 'throttled';                  // Status when the request gets throttled
  this.ERRORED           = options.FAILED            || 'errored';                    // Status when the request has thrown an internal error
  this.RETRY_FAILED      = options.RETRY_FAILED      || false;                        // whether to retry a request if it throws an internal error or not
  this.RETRY_ERRORED     = options.RETRY_ERRORED     || false;                        // whether to retry a request if it returns an http error code
  this.LOGGER            = options.LOGGER            || function(text){console.log(text);}; // Logger function
  this.NAME              = options.NAME              || 'Funky Baboon';               // The Baboon name for log identification
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
        this.status = self.THROTTLED;
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
  _.remove(this._inflight, {status: self.FULFILLED});
};

CapeBaboon.prototype._removeThrottled = function(){
  var throttled = _.remove(this._inflight, {status: self.THROTTLED});
  if (throttled.length > 0) this._retry(throttled);
};

CapeBaboon.prototype._retry = function(requests){
  var self = this;
  this._pending.unshift.apply(this._pending, requests);
  this._retryTimeout = setTimeout(function(){
    self._reset();
    self._proceed();
  }, self.RETRY_TIMEOUT);
  self._numSlots = 0;
};


CapeBaboon.prototype._startPending = function(){
  var self = this;
  var startRequests = Math.min(this._numSlots, this._pending.length);

  _.times(startRequests, function () {
    var request = self._pending.shift();
    request.status = self.INFLIGHT;
    try {
      request.call()
      .then(successHandler, errorHandler);
    } catch (e){
      if(self.RETRY_ERRORED){
        logger('ERROR THROTTLED'+e);
        request.status = self.THROTTLED;
        self._proceed();
      }else{
        request.status = self.ERRORED;
        request.reject(e);
      }
      return;
    }
    self._takeSlot();
    self._inflight.push(request);

    function successHandler(result){
      if (result.status === self.TOO_MANY_REQUESTS) {
        logger('MESSAGE THROTTLED: '+result.status);
        request.status = self.THROTTLED;
      } else {
        request.status = self.FULFILLED;
        request.resolve(result);
      }
      self._proceed();
    }

    function errorHandler(error){
      if(self.RETRY_FAILED){
        logger('FAIL THROTTLED: '+error);
        request.status = self.THROTTLED;
      }else{
        request.status = self.FULFILLED;
        request.reject(error);
      }
      self._proceed();
    }
  });
};

CapeBaboon.prototype._takeSlot = function(){
  if (this._numSlots > 0) {
    this._numSlots--;
    setTimeout(respawnSlot, self.SLOT_RESPAWN);
  } else {
    throw new Error('No slots available');
  }

  var self = this;
  function respawnSlot(){
    if (self._isWaitingForRetry()) return;
    if (self._numSlots < self.LIMIT_PER_SECOND) {
      self._numSlots++;
      self._proceed();
    }
  }
};

CapeBaboon.prototype._reset = function(){
  this._numSlots = self.LIMIT_PER_SECOND;
  this._retryTimeout = null;
};

CapeBaboon.prototype._isWaitingForRetry = function(){
  return this._retryTimeout !== null && this._retryTimeout !== undefined;
};

module.exports = CapeBaboon;
