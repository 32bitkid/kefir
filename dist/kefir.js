/*! kefir - 0.1.1
 *  https://github.com/pozadi/kefir
 */
(function(global){
  "use strict";


  // Class method names convention
  //
  // __foo: can be used only inside class or child class
  // _foo: can be used only inside Kefir
  // foo: public API





  var Kefir = {};

  Kefir.END = ['<end>'];
  Kefir.NO_MORE = ['<no more>'];



  // Utils

  function noop(){}

  function own(obj, prop){
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  function createObj(proto) {
    var F = function(){};
    F.prototype = proto;
    return new F();
  }

  function extend(to, from) {
    for (var prop in from) {
      if(own(from, prop)) {
        to[prop] = from[prop];
      }
    }
  }

  function inherit(Child, Parent, childPrototype) {
    Child.prototype = createObj(Parent.prototype);
    Child.prototype.constructor = Child;
    if (childPrototype) {
      extend(Child.prototype, childPrototype)
    }
    return Child;
  }

  function removeFromArray(array, value) {
    for (var i = 0; i < array.length;) {
      if (array[i] === value) {
        array.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  function killInArray(array, value) {
    for (var i = 0; i < array.length; i++) {
      if (array[i] === value) {
        array[i] = null;
      }
    }
  }

  function isAllDead(array) {
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        return false;
      }
    }
    return true;
  }

  function firstArrOrToArr(args) {
    if (Object.prototype.toString.call(args[0]) === '[object Array]') {
      return args[0];
    }
    return Array.prototype.slice.call(args);
  }







  // Base Stream class

  var Stream = Kefir.Stream = inherit(function Stream(onFirstIn, onLastOut){

    // __onFirstIn, __onLastOut can also be added to prototype of child classes
    if (typeof onFirstIn === "function") {
      this.__onFirstIn = onFirstIn;
    }
    if (typeof onFirstIn === "function") {
      this.__onLastOut = onLastOut;
    }

    this.__subscribers = [];
    this.__contexts = [];
    this.__endSubscribers = [];
    this.__endContexts = [];
  }, Object, {

    _send: function(value) {
      if (!this.isEnded()) {
        if (value === Kefir.END) {
          this.__end();
        } else {
          for (var i = 0; i < this.__subscribers.length; i++) {
            var callback = this.__subscribers[i];
            var context = this.__contexts[i];
            if (typeof callback === "function") {
              if(Kefir.NO_MORE === callback.call(context, value)) {
                this.off(callback, context);
              }
            }
          }
        }
      }
    },
    on: function(callback, context) {
      if (!this.isEnded()) {
        this.__subscribers.push(callback);
        this.__contexts.push(context);
        if (this.__subscribers.length === 1) {
          this.__onFirstIn();
        }
      }
    },
    off: function(callback, context) {
      if (!this.isEnded()) {
        for (var i = 0; i < this.__subscribers.length; i++) {
          if (this.__subscribers[i] === callback && this.__contexts[i] === context) {
            this.__subscribers[i] = null;
            this.__contexts[i] = null;
          }
        }
        if (isAllDead(this.__subscribers)) {
          this.__subscribers = [];
          this.__contexts = [];
          this.__onLastOut();
        }
      }
    },
    onEnd: function(callback, context) {
      if (this.isEnded()) {
        callback();
      } else {
        this.__endSubscribers.push(callback);
        this.__endContexts.push(context);
      }
    },
    offEnd: function(callback, context) {
      if (!this.isEnded()){
        for (var i = 0; i < this.__endSubscribers.length; i++) {
          if (this.__endSubscribers[i] === callback && this.__endContexts[i] === context) {
            this.__endSubscribers[i] = null;
            this.__endContexts[i] = null;
          }
        }
      }
    },
    isEnded: function() {
      return this.__subscribers === null;
    },
    hasSubscribers: function(){
      return !this.isEnded() && this.__subscribers.length > 0;
    },
    __onFirstIn: noop,
    __onLastOut: noop,
    __sendEnd: function(){
      this._send(Kefir.END);
    },
    __end: function() {
      if (!this.isEnded()) {
        this.__onLastOut();
        if (own(this, '__onFirstIn')) {
          this.__onFirstIn = null;
        }
        if (own(this, '__onLastOut')) {
          this.__onLastOut = null;
        }
        this.__subscribers = null;
        this.__contexts = null;
        for (var i = 0; i < this.__endSubscribers.length; i++) {
          if (typeof this.__endSubscribers[i] === "function") {
            this.__endSubscribers[i].call(this.__endContexts[i]);
          }
        }
        this.__endSubscribers = null;
        this.__endContexts = null;
      }
    }

  });






  // Never

  var neverObj = createObj(Stream.prototype);
  neverObj.__subscribers = null;
  Kefir.never = function() {
    return neverObj;
  }




  // Once

  var OnceStream = Kefir.OnceStream = inherit(function OnceStream(value){
    Stream.call(this);
    this.__value = value;
  }, Stream, {

    __onFirstIn: function(){
      this._send(this.__value);
      this.__value = null;
      this._send(Kefir.END);
    }

  });

  Kefir.once = function(value) {
    return new OnceStream(value);
  }




  // Property

  var Property = Kefir.Property = inherit(function Property(onFirstIn, onLastOut, initialValue){
    Stream.call(this, onFirstIn, onLastOut);
    this.__hasCached = (typeof initialValue !== "undefined");
    this.__cached = initialValue;
  }, Stream, {

    onChanges: function(callback, context){
      Stream.prototype.on.call(this, callback, context);
    },
    on: function(callback, context) {
      if (this.__hasCached) {
        callback(this.__cached);
      }
      this.onChanges(callback, context);
    },
    _send: function(value) {
      if (!this.isEnded()){
        this.__hasCached = true;
        this.__cached = value;
      }
      Stream.prototype._send.call(this, value);
    }

  })

  var PropertyFromStream = Kefir.PropertyFromStream = inherit(function PropertyFromStream(sourceStream, initialValue){
    Property.call(this, null, null, initialValue);
    this.__sourceStream = sourceStream;
    sourceStream.onEnd(this.__sendEnd, this);
  }, Property, {

    __onFirstIn: function(){
      this.__sourceStream.on(this._send, this);
    },
    __onLastOut: function(){
      this.__sourceStream.off(this._send, this);
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceStream = null;
    }

  })

  Kefir.toProperty = function(sourceStream, initialValue){
    return new PropertyFromStream(sourceStream, initialValue);
  }
  Stream.prototype.toProperty = function(initialValue){
    return Kefir.toProperty(this, initialValue);
  }




  // Property::changes()

  var PropertyChangesStream = Kefir.PropertyChangesStream = inherit(function PropertyChangesStream(property){
    Stream.call(this);
    this.__sourceProperty = property;
    var _this = this;
    property.onEnd(function(){  _this._send(Kefir.END)  })
  }, Stream, {

    __onFirstIn: function(){
      this.__sourceProperty.onChanges(this._send, this);
    },
    __onLastOut: function(){
      this.__sourceProperty.off(this._send, this);
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceProperty = null;
    }

  })

  Kefir.changes = function(property){
    return new PropertyChangesStream(property);
  }

  Property.prototype.changes = function() {
    return Kefir.changes(this);
  };





  // fromBinder

  var FromBinderStream = Kefir.FromBinderStream = inherit(function FromBinderStream(generator){
    Stream.call(this);
    this.__generator = generator;
    var _this = this;
    this.__deliver = function(x){  _this._send(x)  }
  }, Stream, {

    __onFirstIn: function(){
      this.__generatorUsubscriber = this.__generator(this.__deliver);
    },
    __onLastOut: function(){
      if (typeof this.__generatorUsubscriber === "function") {
        this.__generatorUsubscriber();
      }
      this.__generatorUsubscriber = null;
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__generator = null;
      this.__deliver = null;
    }

  })

  Kefir.fromBinder = function(generator){
    return new FromBinderStream(generator);
  }








  // Bus

  var Bus = Kefir.Bus = inherit(function Bus(){
    Stream.call(this);
    this.__plugged = [];
  }, Stream, {

    push: function(x){
      this._send(x)
    },
    plug: function(stream){
      if (!this.isEnded()) {
        this.__plugged.push(stream);
        if (this.hasSubscribers()) {
          stream.on(this._send, this);
        }
        var _this = this;
        stream.onEnd(function(){  _this.unplug(stream)  });
      }
    },
    unplug: function(stream){
      if (!this.isEnded()) {
        stream.off(this._send, this);
        removeFromArray(this.__plugged, stream);
      }
    },
    end: function(){
      this._send(Kefir.END);
    },
    __onFirstIn: function(){
      for (var i = 0; i < this.__plugged.length; i++) {
        this.__plugged[i].on(this._send, this);
      }
    },
    __onLastOut: function(){
      for (var i = 0; i < this.__plugged.length; i++) {
        this.__plugged[i].off(this._send, this);
      }
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__plugged = null;
      this.push = noop;
    }

  });




  // FromPoll

  var FromPollStream = Kefir.FromPollStream = inherit(function FromPollStream(interval, sourceFn){
    Stream.call(this);
    this.__interval = interval;
    this.__intervalId = null;
    var _this = this;
    this.__deliver = function(){  _this._send(sourceFn())  }
  }, Stream, {

    __onFirstIn: function(){
      this.__intervalId = setInterval(this.__deliver, this.__interval);
    },
    __onLastOut: function(){
      if (this.__intervalId !== null){
        clearInterval(this.__intervalId);
        this.__intervalId = null;
      }
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__deliver = null;
    }

  });

  Kefir.fromPoll = function(interval, sourceFn){
    return new FromPollStream(interval, sourceFn);
  }



  // Interval

  Kefir.interval = function(interval, value){
    return new FromPollStream(interval, function(){  return value });
  }



  // Sequentially

  Kefir.sequentially = function(interval, values){
    values = values.slice(0);
    return new FromPollStream(interval, function(){
      if (values.length === 0){
        return Kefir.END;
      } else {
        return values.shift();
      }
    });
  }



  // Repeatedly

  Kefir.repeatedly = function(interval, values){
    var i = -1;
    return new FromPollStream(interval, function(){
      return values[++i % values.length];
    });
  }




  // Map

  var MappedStream = Kefir.MappedStream = inherit(function MappedStream(sourceStream, mapFn){
    Stream.call(this)
    this.__sourceStream = sourceStream;
    this.__mapFn = mapFn;
    sourceStream.onEnd(this.__sendEnd, this);
  }, Stream, {

    __mapAndSend: function(x){
      this._send( this.__mapFn(x) );
    },
    __onFirstIn: function(){
      this.__sourceStream.on(this.__mapAndSend, this);
    },
    __onLastOut: function(){
      this.__sourceStream.off(this.__mapAndSend, this);
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceStream = null;
      this.__mapFn = null;
    }

  });

  Kefir.map = function(stream, mapFn) {
    return new MappedStream(stream, mapFn);
  }

  Stream.prototype.map = function(fn) {
    return Kefir.map(this, fn);
  };





  // Filter

  var FilteredStream = Kefir.FilteredStream = inherit(function FilteredStream(sourceStream, filterFn){
    MappedStream.call(this, sourceStream, filterFn);
  }, MappedStream, {

    __mapAndSend: function(x){
      if (this.__mapFn(x)) {
        this._send(x);
      }
    }

  });

  Kefir.filter = function(stream, filterFn) {
    return new FilteredStream(stream, filterFn);
  }

  Stream.prototype.filter = function(fn) {
    return Kefir.filter(this, fn);
  };




  // TakeWhile

  var TakeWhileStream = Kefir.TakeWhileStream = inherit(function TakeWhileStream(sourceStream, filterFn){
    MappedStream.call(this, sourceStream, filterFn);
  }, MappedStream, {

    __mapAndSend: function(x){
      if (this.__mapFn(x)) {
        this._send(x);
      } else {
        this._send(Kefir.END);
      }
    }

  });

  Kefir.takeWhile = function(stream, filterFn) {
    return new TakeWhileStream(stream, filterFn);
  }

  Stream.prototype.takeWhile = function(fn) {
    return Kefir.takeWhile(this, fn);
  };




  // Take

  Kefir.take = function(stream, n) {
    return new TakeWhileStream(stream, function(){
      return n-- > 0;
    });
  }

  Stream.prototype.take = function(n) {
    return Kefir.take(this, n);
  };






  // FlatMap

  var FlatMappedStream = Kefir.FlatMappedStream = inherit(function FlatMappedStream(sourceStream, mapFn){
    Stream.call(this)
    this.__sourceStream = sourceStream;
    this.__plugged = [];
    this.__mapFn = mapFn;
    sourceStream.onEnd(this.__sendEnd, this);
  }, Stream, {

    __plugResult: function(x){
      this.__plug(  this.__mapFn(x)  );
    },
    __onFirstIn: function(){
      this.__sourceStream.on(this.__plugResult, this);
      for (var i = 0; i < this.__plugged.length; i++) {
        this.__plugged[i].on(this._send, this);
      }
    },
    __onLastOut: function(){
      this.__sourceStream.off(this.__plugResult, this);
      for (var i = 0; i < this.__plugged.length; i++) {
        this.__plugged[i].off(this._send, this);
      }
    },
    __plug: function(stream){
      this.__plugged.push(stream);
      if (this.hasSubscribers()) {
        stream.on(this._send, this);
      }
      var _this = this;
      stream.onEnd(function(){  _this.__unplug(stream)  });
    },
    __unplug: function(stream){
      if (!this.isEnded()) {
        stream.off(this._send, this);
        removeFromArray(this.__plugged, stream);
      }
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceStream = null;
      this.__mapFn = null;
      this.__plugged = null;
    }

  });

  Kefir.flatMap = function(stream, mapFn) {
    return new FlatMappedStream(stream, mapFn);
  }

  Stream.prototype.flatMap = function(fn) {
    return Kefir.flatMap(this, fn);
  };








  // Merge

  var MergedStream = Kefir.MergedStream = inherit(function MergedStream(){
    Stream.call(this)
    this.__sourceStreams = firstArrOrToArr(arguments);
    for (var i = 0; i < this.__sourceStreams.length; i++) {
      this.__sourceStreams[i].onEnd(
        this.__unplugFor(this.__sourceStreams[i])
      );
    }
  }, Stream, {

    __onFirstIn: function(){
      for (var i = 0; i < this.__sourceStreams.length; i++) {
        this.__sourceStreams[i].on(this._send, this);
      }
    },
    __onLastOut: function(){
      for (var i = 0; i < this.__sourceStreams.length; i++) {
        this.__sourceStreams[i].off(this._send, this);
      }
    },
    __unplug: function(stream){
      stream.off(this._send, this);
      removeFromArray(this.__sourceStreams, stream);
      if (this.__sourceStreams.length === 0) {
        this._send(Kefir.END);
      }
    },
    __unplugFor: function(stream){
      var _this = this;
      return function(){  _this.__unplug(stream)  }
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceStreams = null;
    }

  });

  Kefir.merge = function() {
    return new MergedStream(firstArrOrToArr(arguments));
  }

  Stream.prototype.merge = function() {
    return Kefir.merge([this].concat(firstArrOrToArr(arguments)));
  }









  // Combine

  var CombinedStream = Kefir.CombinedStream = inherit(function CombinedStream(sourceStreams, mapFn){
    Stream.call(this)

    this.__sourceStreams = sourceStreams;
    this.__cachedValues = new Array(sourceStreams.length);
    this.__hasCached = new Array(sourceStreams.length);
    this.__receiveFns = new Array(sourceStreams.length);
    this.__mapFn = mapFn;

    for (var i = 0; i < this.__sourceStreams.length; i++) {
      this.__receiveFns[i] = this.__receiveFor(i);
      this.__sourceStreams[i].onEnd( this.__unplugFor(i) );
    }

  }, Stream, {

    __onFirstIn: function(){
      for (var i = 0; i < this.__sourceStreams.length; i++) {
        if (this.__sourceStreams[i]) {
          this.__sourceStreams[i].on(this.__receiveFns[i]);
        }
      }
    },
    __onLastOut: function(){
      for (var i = 0; i < this.__sourceStreams.length; i++) {
        if (this.__sourceStreams[i]) {
          this.__sourceStreams[i].off(this.__receiveFns[i]);
        }
      }
    },
    __unplug: function(i){
      this.__sourceStreams[i].off(this.__receiveFns[i]);
      this.__sourceStreams[i] = null
      this.__receiveFns[i] = null
      if (isAllDead(this.__sourceStreams)) {
        this._send(Kefir.END);
      }
    },
    __unplugFor: function(i){
      var _this = this;
      return function(){  _this.__unplug(i)  }
    },
    __receive: function(i, value) {
      this.__hasCached[i] = true;
      this.__cachedValues[i] = value;
      if (this.__allCached()) {
        if (typeof this.__mapFn === "function") {
          this._send(this.__mapFn.apply(null, this.__cachedValues));
        } else {
          this._send(this.__cachedValues.slice(0));
        }
      }
    },
    __receiveFor: function(i) {
      var _this = this;
      return function(value){
        _this.__receive(i, value);
      }
    },
    __allCached: function(){
      for (var i = 0; i < this.__hasCached.length; i++) {
        if (!this.__hasCached[i]) {
          return false;
        }
      }
      return true;
    },
    __end: function(){
      Stream.prototype.__end.call(this);
      this.__sourceStreams = null;
      this.__cachedValues = null;
      this.__hasCached = null;
      this.__receiveFns = null;
      this.__mapFn = null;
    }

  });

  Kefir.combine = function(streams, mapFn) {
    return new CombinedStream(streams, mapFn);
  }

  Stream.prototype.combine = function(streams, mapFn) {
    return Kefir.combine([this].concat(streams), mapFn);
  }





  // Log

  Stream.prototype.log = function(text) {
    function log(value){
      if (text) {
        console.log(text, value);
      } else {
        console.log(value);
      }
    }
    this.on(log);
    this.onEnd(function(){  log(Kefir.END)  });
  }





  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return Kefir;
    });
    global.Kefir = Kefir;
  } else if (typeof module === "object" && typeof exports === "object") {
    module.exports = Kefir;
    Kefir.Kefir = Kefir;
  } else {
    global.Kefir = Kefir;
  }

}(this));
