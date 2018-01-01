let request = require('request');
let Service, Characteristic;

const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory('homebridge-serial-projector', 'SerialProjector', SerialProjector);
};

function SerialProjector(log, config) {
  this.log = log;
  this.name = config.name || 'TV';
  this.powerSwitchName = config.power_switch_name || `${this.name} Power`;
  this.speakerSwitchName = config.speaker_switch_name || `${this.name} Speaker`;
  this.displaySwitchName = config.display_switch_name || `${this.name} Display`;
  this.macAddress = config.mac_address ? config.mac_address.toLowerCase() : null;
  this.ip = null;
  this.lastPowerState = null;
  this.remoteQueue = [];
  this.remoteQueueInProcess = false;
  this.discoverIntervalSeconds = 30;

  if (!this.macAddress) {
    throw new Error('MAC address required for ' + this.name);
  }

  this.log.debug('Initializing [' + this.name + '] @ [' + this.macAddress + ']');

  this.listen();
  this.discover();
  setInterval(() => {
    this.discover();
  }, this.discoverIntervalSeconds * 1000);
}

SerialProjector.prototype = {
  listen: function () {
    socket.on('message', (message, rinfo) => {
      this.log.debug(`Server got: ${message} from ${rinfo.address}:${rinfo.port}`);

      message = message.toString('UTF-8').trim().toLowerCase();
      if (!message || !message.startsWith('mac_address: ')) {
        return;
      }

      const macAddress = message.replace('mac_address: ', '');
      if (this.macAddress !== macAddress) {
        return;
      }

      // Discovered
      this.ip = rinfo.address;
      this.log.debug(`Identified: ${this.macAddress} => ${this.ip}`);
    });

    socket.bind(2367, () => {
      socket.addMembership('224.33.66.77');
    });
  },
  discover: function () {
    this.log.debug('Discovering...');
    socket.send('discover', 2367, '224.33.66.77', (error) => {
      if (error) {
        return this.log.error('Error while discovering:', error);
      }
    });
  },
  dequeueNextRemote: function (initiator = false) {
    if (!this.remoteQueue.length) {
      this.remoteQueueInProcess = false;
      return;
    }

    if (this.remoteQueueInProcess && initiator) {
      return;
    }

    this.remoteQueueInProcess = true;

    let job = this.remoteQueue.shift();
    job(this.dequeueNextRemote.bind(this));
  },

  enqueueRemote: function (job) {
    this.remoteQueue.push(job);

    this.dequeueNextRemote(true);
  },

  remote: function (controlType, targetState, resultStateCallback) {
    controlType = controlType.toLowerCase();
    targetState = targetState.toLowerCase();

    if (['pow', 'mute', 'blank'].includes(controlType) && ['on', 'off', '?'].includes(targetState)) {
      ;
    } else {
      return resultStateCallback(false);
    }

    let url = 'http://' + this.ip + '/cgi-bin/pctrl/' + controlType + '/' + encodeURIComponent(targetState);
    let searchOnState = '*' + controlType.toUpperCase() + '=' + 'ON#';
    let searchOffState = '*' + controlType.toUpperCase() + '=' + 'OFF#';
    let searchAlreadyInTargetState = '*Block item#';
    let foundOnState = false;

    this.enqueueRemote(function (next) {
      // Only the state of POW power control type could be retrieved when powered off,
      // for other control types, return the WYSIWYG state directly
      if (this.lastPowerState === false && ['mute', 'blank'].includes(controlType)) {
        this.log.debug('Device is powered off, response state directly');
        resultStateCallback('on');
        return next();
      }

      this.log.debug('Requesting ' + url);
      request(url, function (error, response, body) {
        if (error) {
          resultStateCallback(false);
          return next();
        }

        let responseContent = body;
        this.log.debug('Response:\n' + responseContent);

        if (targetState === '?') {
          if ((foundOnState = responseContent.includes(searchOnState)) || responseContent.includes(searchOffState)) {
            resultStateCallback((foundOnState ? 'on' : 'off'));
            return next();
          }
        }

        if (['on', 'off'].includes(targetState)) {
          if (responseContent.includes(targetState === 'on' ? searchOnState : searchOffState) || responseContent.includes(searchAlreadyInTargetState)) {
            resultStateCallback(targetState);
            return next();
          }
        }

        resultStateCallback(false);
        return next();
      }.bind(this));
    }.bind(this));
  },

  getPowerState: function (callback) {
    this.remote('pow', '?', (resultPowerState) => {
      if (resultPowerState === false) {
        callback(new Error('Failed to get power state of ' + this.name));
        return;
      }

      this.lastPowerState = (resultPowerState === 'on');

      callback(null, this.lastPowerState);
    });
  },

  getSpeakerState: function (callback) {
    this.remote('mute', '?', (resultMuteState) => {
      if (resultMuteState === false) {
        callback(new Error('Failed to get speaker state of ' + this.name));
        return;
      }

      callback(null, (resultMuteState === 'off'));
    });
  },

  getDisplayState: function (callback) {
    this.remote('blank', '?', (resultBlankState) => {
      if (resultBlankState === false) {
        callback(new Error('Failed to get display state of ' + this.name));
        return;
      }

      callback(null, (resultBlankState === 'off'));
    });
  },

  setPowerState: function (state, callback) {
    let targetState = (state === true) ? 'on' : 'off';
    this.remote('pow', targetState, (resultState) => {
      if (resultState === false) {
        callback(new Error('Failed to set power state of ' + this.name + ' to ', targetState));
        return;
      }

      callback();
    });
  },

  setSpeakerState: function (state, callback) {
    let targetState = (state === true) ? 'off' : 'on';
    this.remote('mute', targetState, (resultState) => {
      if (resultState === false) {
        callback(new Error('Failed to set speaker state of ' + this.name + ' to ' + targetState));
        return;
      }

      callback();
    });
  },

  setDisplayState: function (state, callback) {
    let targetState = (state === true) ? 'off' : 'on';
    this.remote('blank', targetState, (resultState) => {
      if (resultState === false) {
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

    this.powerService = new Service.Switch(this.powerSwitchName, 'power');
    this.powerService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));
    this.log.debug(`Initialized power switch: ${this.powerSwitchName}`);

    this.speakerService = new Service.Switch(this.speakerSwitchName, 'speaker');
    this.speakerService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSpeakerState.bind(this))
      .on('set', this.setSpeakerState.bind(this));
    this.log.debug(`Initialized speaker switch: ${this.speakerSwitchName}`);

    this.displayService = new Service.Switch(this.displaySwitchName, 'display');
    this.displayService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getDisplayState.bind(this))
      .on('set', this.setDisplayState.bind(this));
    this.log.debug(`Initialized display switch: ${this.displaySwitchName}`);

    return [this.informationService, this.powerService, this.speakerService, this.displayService];
  }
};
