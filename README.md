# homebridge-serial-projector

A Homebridge plugin to control BenQ Projector via Serial Port and OpenWrt.

## Features

* Power toggle
* Mute toggle
* Eco Blank (dim the display) toggle

## Requirements

* A BenQ Projector
* A Serial to USB adapter (Prolific PL2303 chip recommended)
* A RS232 crossover (null modem) cable
* An OpenWrt router with USB port
* An existing home network (wired or wireless)

## Installation

### 1. OpenWrt router preparation

Run `firstboot` on the OpenWrt to get an clean reset.

#### 1.1. Install packages

    opkg install coreutils coreutils-stty kmod-usb-serial kmod-usb-serial-pl2303

#### 1.2. Install executables

    scp ./openwrt/fs/root/pctrl.sh     root@ip-of-openwrt:/root/
    scp ./openwrt/fs/www/cgi-bin/pctrl root@ip-of-openwrt:/www/cgi-bin/

#### 1.3. Configure OpenWrt as a routed client to your main (wireless) router

Refer to the [OpenWrt Wiki](https://wiki.openwrt.org/doc/recipes/routedclient).

#### 1.4. Remember the IP address

Ensure the IP address of OpenWrt router accessibly from the main router network.

#### 1.5. Confirm working scripts

Browse the following URLs on your computer connected to the main router network:

* get status: http://ip-of-openwrt/cgi-bin/pctrl/pow/%3F
* turn on: http://ip-of-openwrt/cgi-bin/pctrl/pow/on
* turn off: http://ip-of-openwrt/cgi-bin/pctrl/pow/off

### 2. Configure Homebridge

Refer to [Homebridge repo](https://github.com/nfarina/homebridge) for more detail.

### 2.1. Install packages

    npm install -g homebridge
    git clone https://github.com/gaomd/homebridge-serial-projector.git
    cd homebridge-serial-projector
    npm install

### 2.2. Add `~/.homebridge/config.json`

    {
        "bridge": {
            "//0": "Remove this line and refer to: https://github.com/nfarina/homebridge/blob/master/config-sample.json"
        },
        "accessories": [
            {
                "accessory": "SerialProjector",
                "name": "TV",                           "//0": "required, default to TV (aka {name})",
                "power_switch_name": "TV Power",        "//1": "optional, default to {name} Power",
                "speaker_switch_name": "TV Speaker",    "//2": "optional, default to {name} Speaker",
                "display_switch_name": "TV Display",    "//3": "optional, default to {name} Display",
                "ip": "ip-of-openwrt, e.g. 192.168.1.123"
            }
        ]
    }

### 2.3. Run Homebridge

    homebridge -D -P /path/to/homebridge-serial-projector

### 2.4. Configure the iOS Home app

Open the Home app on your iOS device.
