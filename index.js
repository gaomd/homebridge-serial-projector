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

  if (!this.ip) {
    throw new Error('IP address required for ' + this.name);
  }

  this.log.debug('Initialized [' + this.name + '] @ [', this.ip + ']');
}

SerialProjector.prototype = {
  remote: function (controlType, targetState) {
    controlType = controlType.toLowerCase();
    targetState = targetState.toLowerCase();

    if (['pow', 'mute', 'blank'].includes(controlType) && ['on', 'off', 'status'].includes(targetState)) {
      ;
    } else {
      return false;
    }

    let url = 'http://' + this.ip + '/cgi-bin/pctrl/' + controlType + '/' + encodeURIComponent((targetState === 'status') ? '?' : targetState);
    let searchOnState = '*' + controlType.toUpperCase() + '=' + 'ON#';
    let searchOffState = '*' + controlType.toUpperCase() + '=' + 'OFF#';
    let searchAlreadyInTargetState = '*Block item#';
    let foundOnState = false;

    let response = request('GET', url);
    let responseContent = response.getBody('utf-8');

    this.log.debug("Requesting " + url);
    this.log.debug(responseContent);

    if (targetState === 'status') {
      if ((foundOnState = responseContent.includes(searchOnState)) || responseContent.includes(searchOffState)) {
        return foundOnState ? 'on' : 'off';
      }
    }

    if (targetState === 'on' || targetState === 'off') {
      if (responseContent.includes(targetState === 'on' ? searchOnState : searchOffState) || responseContent.includes(searchAlreadyInTargetState)) {
        return targetState;
      }
    }

    return false;
  },

  getPowerState: function (callback) {
    let power = this.remote('pow', 'status');

    if (power === false) {
      callback(new Error('Failed to get power state of ' + this.name));
      return;
    }

    callback(null, (power === 'on'));
  },

  getSpeakerState: function (callback) {
    let mute = this.remote('mute', 'status');

    if (mute === false) {
      callback(new Error('Failed to get speaker state of ' + this.name));
      return;
    }

    callback(null, (mute === 'off'));
  },

  getDisplayState: function (callback) {
    let blank = this.remote('blank', 'status');

    if (blank === false) {
      callback(new Error('Failed to get display state of ' + this.name));
      return;
    }

    callback(null, (blank === 'off'));
  },

  setPowerState: function (state, callback) {
    let targetState = (state === true) ? 'on' : 'off';
    let res = this.remote('pow', targetState);

    if (res === false) {
      callback(new Error('Failed to set power state of ' + this.name + ' to ', targetState));
      return;
    }

    callback();
  },

  setSpeakerState: function (state, callback) {
    let targetState = (state === true) ? 'off' : 'on';
    let res = this.remote('mute', targetState);

    if (res === false) {
      callback(new Error('Failed to set speaker state of ' + this.name + ' to ' + targetState));
      return;
    }

    callback();
  },

  setDisplayState: function (state, callback) {
    let targetState = (state === true) ? 'off' : 'on';
    let res = this.remote('blank', targetState);

    if (res === false) {
      callback(new Error('Failed to set display state of ' + this.name + ' to ', targetState));
      return;
    }

    callback();
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
      .on('set', this.setPowerState.bind(this))
      // .updateValue(this.getPowerState());

    this.speakerService = new Service.Switch(this.name + ' Speaker', 'speaker');
    this.speakerService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSpeakerState.bind(this))
      .on('set', this.setSpeakerState.bind(this))
      // .updateValue(this.getSpeakerState());

    this.displayService = new Service.Switch(this.name + ' Display', 'display');
    this.displayService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getDisplayState.bind(this))
      .on('set', this.setDisplayState.bind(this))
      // .updateValue(this.getDisplayState());

    return [this.informationService, this.powerService, this.speakerService, this.displayService];
  }
};
