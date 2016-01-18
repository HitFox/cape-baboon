'use strict';

var _ = require('lodash-node/modern');
var P = require("bluebird");

var RETRY_TIMEOUT     = 0;
var LIMIT_PER_SECOND  = 0;
var SLOT_RESPAWN      = 0;
var TOO_MANY_REQUESTS = 0;
var INFLIGHT          = 'not set';
var FULFILLED         = 'not set';
var THROTTLED         = 'not set';
var ERRORED           = 'not set';


function CapeBaboon(options) {
  RETRY_TIMEOUT     = options.RETRY_TIMEOUT     || 1000;
  LIMIT_PER_SECOND  = options.LIMIT_PER_SECOND  || 10;
  SLOT_RESPAWN      = options.SLOT_RESPAWN      || 4.0 * 1000/LIMIT_PER_SECOND;
  TOO_MANY_REQUESTS = options.TOO_MANY_REQUESTS || 429;
  INFLIGHT          = options.INFLIGHT          || 'inflight';
  FULFILLED         = options.FULFILLED         || 'fulfilled';
  THROTTLED         = options.THROTTLED         || 'throttled';
  ERRORED           = options.ERRORED           || 'errored';
  this._pending      = [];
  this._inflight     = [];
  this._reset();
}

CapeBaboon.prototype.push = function (call) {
  var self = this;
  var promise = new P(function(resolve, reject){
    self._pending.push({
      call: call,
      resolve: resolve,
      reject: reject,
      status: null
    });
  });
  this._proceed();
  return promise;
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
      request.status = ERRORED;
      request.reject(e);
      return;
    }
    self._takeSlot();
    self._inflight.push(request);

    function successHandler(result){
      if (result.status === TOO_MANY_REQUESTS) {
        console.log('THROTTLED');
        request.status = THROTTLED;
      } else {
        request.status = FULFILLED;
        request.resolve(result);
      }
      self._proceed();
    }

    function errorHandler(error){
      request.status = FULFILLED;
      request.reject(error);
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
