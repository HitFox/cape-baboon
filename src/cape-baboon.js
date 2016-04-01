'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const    INFLIGHT    = 'inflight';  // Status while the request call is active
const    FULFILLED   = 'fulfilled'; // Status when the request was successfull
const    THROTTLED   = 'throttled'; // Status when the request gets throttled
const    ERRORED     = 'errored';   // Status when the request has thrown an internal error

function CapeBaboon(options) {
  options = options || {};

  // the time to wait for retrying a request
  this.RETRY_TIMEOUT     = options.RETRY_TIMEOUT     || 1000;

  // the time to wait for retrying a request
  this.LIMIT_PER_SECOND  = options.LIMIT_PER_SECOND  || 10;

  // Time in miliseconds for respawning the slots
  this.SLOT_RESPAWN      = options.SLOT_RESPAWN      || 4.0 * 1000 / this.LIMIT_PER_SECOND;

  // The return Status from the Server if there are too many request sent to it. If applicable.
  this.TOO_MANY_REQUESTS = options.TOO_MANY_REQUESTS || 429;

  // whether to retry a request if it throws an internal error or not
  this.RETRY_FAILED      = options.RETRY_FAILED      || false;

  // VALIDATOR for status 200
  this.VALIDATOR         = options.VALIDATOR         || function () { return true; };

  // error callback
  this.ERROR_CALLBACK    = options.ERROR_CALLBACK    || function () {return;};

  // max attemps
  this.MAX_ATTEMPS       = options.MAX_ATTEMPS       || 10;

  // fail callback
  this.FAIL_CALLBACK     = options.FAIL_CALLBACK     || function () {return;};

  // whether to retry a request if it returns an http error code
  this.RETRY_ERRORED     = options.RETRY_ERRORED     || false;

  // Logger function
  this.LOGGER            = options.LOGGER            || function (text) {console.log(text); };

  // The Baboon name for log identification
  this.NAME              = options.NAME              || 'Funky Baboon';

  // The request Lib (must return a promise)
  this.REQUEST           = options.REQUEST           || require('request-promise');

  this._pending     = [];
  this._inflight    = [];
  this._reset();
}

CapeBaboon.prototype.logger = function (text) {
  this.LOGGER('|' + this.NAME + '| ' + text);
};

CapeBaboon.prototype.push = function (call) {
  var _this = this;
  var promise = new Promise((resolve, reject) => {
    var requestObject = {
      call: call,
      resolve: resolve,
      reject: reject,
      status: null,
      attemps: 1,
      throttle: function () {
        this.status = THROTTLED;
        _this._proceed();
      },
    };
    _this._pending.push(requestObject);
  });

  this._proceed();
  return promise;
};

CapeBaboon.prototype.request = function (options) {
  var _this = this;
  var call = () => _this.REQUEST(options);
  return _this.push(call);
};

CapeBaboon.prototype._proceed = function () {
  this._removeFulfilled();
  this._removeThrottled();
  this._startPending();
};

CapeBaboon.prototype._removeFulfilled = function () {
  var _this = this;
  _.remove(_this._inflight, { status: FULFILLED });
};

CapeBaboon.prototype._removeThrottled = function () {
  var _this = this;
  var throttled = _.remove(this._inflight, { status: THROTTLED });
  if (throttled.length > 0) this._retry(throttled);
};

CapeBaboon.prototype._retry = function (requests) {
  var _this = this;
  this._pending.unshift.apply(_this._pending, requests);
  this._retryTimeout = setTimeout(function () {
    _this._reset();
    _this._proceed();
  }, _this.RETRY_TIMEOUT);
  _this._numSlots = 0;
};

CapeBaboon.prototype._startPending = function () {
  var _this = this;
  var startRequests = Math.min(this._numSlots, this._pending.length);

  _.times(startRequests, () => {
    var request = _this._pending.shift();
    request.status = INFLIGHT;
    try {
      if (request.attemps <= _this.MAX_ATTEMPS) {
        request.attemps++;
        request.call().then(successHandler, errorHandler);
      }else {
        console.log('max attemps reached for:', request);
        request.resolve();
      }
    } catch (e) {
      if (_this.RETRY_ERRORED) {

        _this.logger('ERROR THROTTLED' + e);
        request.status = THROTTLED;
        _this.ERROR_CALLBACK();

        _this._proceed();
      }else {
        request.status = ERRORED;
        request.reject(e);
      }

      return;
    }

    _this._takeSlot();
    _this._inflight.push(request);

    function successHandler(result) {
      if (result.status === _this.TOO_MANY_REQUESTS || !_this.VALIDATOR()) {

        _this.logger('MESSAGE THROTTLED: ' + result.status);
        request.status = THROTTLED;
        _this.FAIL_CALLBACK();

      } else {
        request.status = FULFILLED;
        request.resolve(result);
      }

      _this._proceed();
    }

    function errorHandler(error) {
      if (_this.RETRY_FAILED) {

        _this.logger('ERROR THROTTLED: ');
        request.status = THROTTLED;
        _this.ERROR_CALLBACK();

      }else {
        request.status = FULFILLED;
        request.reject(error);
      }

      _this._proceed();
    }
  });
};

CapeBaboon.prototype._takeSlot = function () {
  var _this = this;
  if (this._numSlots > 0) {
    this._numSlots--;
    setTimeout(respawnSlot, _this.SLOT_RESPAWN);
  } else {
    throw new Error('No slots available');
  }

  function respawnSlot() {
    if (_this._isWaitingForRetry()) return;
    if (_this._numSlots < _this.LIMIT_PER_SECOND) {
      _this._numSlots++;
      _this._proceed();
    }
  }
};

CapeBaboon.prototype._reset = function () {
  var _this = this;
  this._numSlots = _this.LIMIT_PER_SECOND;
  this._retryTimeout = null;
};

CapeBaboon.prototype._isWaitingForRetry = function () {
  return this._retryTimeout !== null && this._retryTimeout !== undefined;
};

module.exports = CapeBaboon;
