let request = require('sync-request');
let Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-serial-projector', 'SerialProjector', SerialProjector);
};

function SerialProjector(log, config) {
  this.log = log;
  this.name = config.name || 'Projector';
  this.ip = config.ip;
  this.lastPowerState = null;
  this.executionQueue = [];
  this.queueInProcess = false;

  if (!this.ip) {
    throw new Error('IP address required for ' + this.name);
  }

  this.log.debug('Initialized [' + this.name + '] @ [', this.ip + ']');
}

SerialProjector.prototype = {
  processQueue: function(inside = false) {
    if (!this.executionQueue.length) {
      return;
    }

    if (this.queueInProcess && !inside) {
      return;
    }

    this.queueInProcess = true;

    let job = this.executionQueue.shift();
    job();

    if (this.executionQueue.length) {
      this.processQueue(inside);
    } else {
      this.queueInProcess = false;
    }
  },

  queueExecution: function (callback) {
    let app = this;
    this.executionQueue.push(function () {
      callback.bind(app)();
    });

    this.processQueue();
  },

  remote: function (controlType, targetState) {
    controlType = controlType.toLowerCase();
    targetState = targetState.toLowerCase();

    if (['pow', 'mute', 'blank'].includes(controlType) && ['on', 'off', '?'].includes(targetState)) {
      ;
    } else {
      return false;
    }

    let url = 'http://' + this.ip + '/cgi-bin/pctrl/' + controlType + '/' + encodeURIComponent(targetState);
    let searchOnState = '*' + controlType.toUpperCase() + '=' + 'ON#';
    let searchOffState = '*' + controlType.toUpperCase() + '=' + 'OFF#';
    let searchAlreadyInTargetState = '*Block item#';
    let foundOnState = false;

    let response = request('GET', url);
    let responseContent = response.getBody('utf-8');

    this.log.debug("Requesting " + url);
    this.log.debug(responseContent);

    // Only the POW power state could be fetched when powered off,
    // in case of fetch other control type states, return their WYSIWYG state
    if (this.lastPowerState === false && ['mute', 'blank'].includes(controlType)) {
      return 'on'
    }

    if (targetState === '?') {
      if ((foundOnState = responseContent.includes(searchOnState)) || responseContent.includes(searchOffState)) {
        return foundOnState ? 'on' : 'off';
      }
    }

    if (['on', 'off'].includes(targetState)) {
      if (responseContent.includes(targetState === 'on' ? searchOnState : searchOffState) || responseContent.includes(searchAlreadyInTargetState)) {
        return targetState;
      }
    }

    return false;
  },

  getPowerState: function (callback) {
    this.queueExecution(function () {
      let power = this.remote('pow', '?');

      if (power === false) {
        callback(new Error('Failed to get power state of ' + this.name));
        return;
      }

      this.lastPowerState = (power === 'on');

      callback(null, this.lastPowerState);
    });
  },

  getSpeakerState: function (callback) {
    this.queueExecution(function () {
      let mute = this.remote('mute', '?');

      if (mute === false) {
        callback(new Error('Failed to get speaker state of ' + this.name));
        return;
      }

      callback(null, (mute === 'off'));
    });
  },

  getDisplayState: function (callback) {
    this.queueExecution(function () {
      let blank = this.remote('blank', '?');

      if (blank === false) {
        callback(new Error('Failed to get display state of ' + this.name));
        return;
      }

      callback(null, (blank === 'off'));
    });
  },

  setPowerState: function (state, callback) {
    this.queueExecution(function () {
      let targetState = (state === true) ? 'on' : 'off';
      let res = this.remote('pow', targetState);

      if (res === false) {
        callback(new Error('Failed to set power state of ' + this.name + ' to ', targetState));
        return;
      }

      callback();
    });
  },

  setSpeakerState: function (state, callback) {
    this.queueExecution(function () {
      let targetState = (state === true) ? 'off' : 'on';
      let res = this.remote('mute', targetState);

      if (res === false) {
        callback(new Error('Failed to set speaker state of ' + this.name + ' to ' + targetState));
        return;
      }

      callback();
    });
  },

  setDisplayState: function (state, callback) {
    this.queueExecution(function () {
      let targetState = (state === true) ? 'off' : 'on';
      let res = this.remote('blank', targetState);

      if (res === false) {
        callback(new Error('Failed to set display state of ' + this.name + ' to ', targetState));
        return;
      }

      callback();
    });
  },

  identify: function (callback) {
    callback();
  },

  getServices: function () {
    this.informationService = new Service.AccessoryInformation();
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, 'BenQ')
      .setCharacteristic(Characteristic.Model, 'W1070+')
      .setCharacteristic(Characteristic.SerialNumber, '1234567890123');

    this.powerService = new Service.Switch(this.name, 'power');
    this.powerService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));

    this.speakerService = new Service.Switch(this.name + ' Speaker', 'speaker');
    this.speakerService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSpeakerState.bind(this))
      .on('set', this.setSpeakerState.bind(this));

    this.displayService = new Service.Switch(this.name + ' Display', 'display');
    this.displayService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getDisplayState.bind(this))
      .on('set', this.setDisplayState.bind(this));

    return [this.informationService, this.powerService, this.speakerService, this.displayService];
  }
};
