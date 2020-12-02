import React, { useState, useEffect } from 'react';
import './App.css';

let aesjs = require('aes-js');

function App() {
	const [supportsBluetooth, setSupportsBluetooth] = useState(false);
	const [isDisconnected, setIsDisconnected] = useState(true);
	const [batteryLevel, setBatteryLevel] = useState(null);
	const [userData, setUserData] = useState({});

	const getKey = async () => {
		const response = await fetch('/users');
		const jsonData = await response.json();
		setUserData(jsonData);
	};

	// When the component mounts, check that the browser supports Bluetooth
	useEffect(() => {
		if (navigator.bluetooth) {
			setSupportsBluetooth(true);
		}
		getKey();
	}, []);

	/**
	 * Let the user know when their device has been disconnected.
	 */
	const onDisconnected = (event) => {
		alert(`The device ${event.target} is disconnected`);
		setIsDisconnected(true);
	}

	/**
	 * Update the value shown on the web page when a notification is
	 * received.
	 */
	//const handleCharacteristicValueChanged = (event) => {
	//	setBatteryLevel(event.target.value.getUint8(0) + '%');
	//}

	/**
	 * Attempts to connect to a Bluetooth device and subscribe to
	 * battery level readings using the battery service.
	 */
	const connectToDeviceAndSubscribeToUpdates = async () => {

		//const service_data_crownstone_uuid = 0xC001;
		const service_crownstone_uuid = '24f00000-7d10-4805-bfc1-7663a01c3bff';
		const char_session_uuid = '24f0000e-7d10-4805-bfc1-7663a01c3bff';
		const char_control_uuid = "24f0000c-7d10-4805-bfc1-7663a01c3bff";
		//const char_result_uuid  = "24f0000d-7d10-4805-bfc1-7663a01c3bff";

		console.log("Search for service: " + service_crownstone_uuid);

		try {
			// Search for Bluetooth devices that advertise a battery service
			const device = await navigator.bluetooth
				.requestDevice({
					filters: [
						//      {name: 'Crown'},
						{name: 'crwn'},
						{name: 'CRWN'}
					],
					optionalServices: [
						service_crownstone_uuid
					]
				});

			console.log("Found device");
			setIsDisconnected(false);

			// Add an event listener to detect when a device disconnects
			device.addEventListener('gattserverdisconnected', onDisconnected);

			// Try to connect to the remote GATT Server running on the Bluetooth device
			console.log("Connect");
			const server = await device.gatt.connect();

			// Get the battery service from the Bluetooth device
			console.log("Get service");
			const service = await server.getPrimaryService(service_crownstone_uuid);

			// Get the session characteristic from the Bluetooth device
			console.log("Get session characteristic");
			const session_char = await service.getCharacteristic(char_session_uuid);

			// Read the battery level value
			console.log("Get value");
			const reading = await session_char.readValue();

			let key = userData.key;
			if (key === undefined) {
				console.log("Key is not defined.");
			}
			let keyBytes = aesjs.utils.hex.toBytes(key);

			// Show the initial reading on the web page
			let inputBytes = new Uint8Array(reading.buffer);
			let aesEcb = new aesjs.ModeOfOperation.ecb(keyBytes);
			let decryptedBytes = aesEcb.decrypt(inputBytes);

			// incoming: [ validation[4], protocol, nonce[5] ]
			let validation = decryptedBytes.slice(0,4);
			console.log("Validation: " + validation);
			let valstr = "";
			for (let i = 3; i >= 0; i-=2) {
				valstr += validation[i].toString(16);
				valstr += validation[i-1].toString(16);
			}
			console.log("Validation as string: " + valstr);
			let protocol = decryptedBytes[4];
			console.log("Protocol: " + protocol);
			let nonce = decryptedBytes.slice(5,10);
			console.log("Nonce", nonce);

			let validation_key = decryptedBytes.slice(10,16);
			console.log("Validation key", validation_key);

			// outgoing: nonce[3], user_level, validation[4], protocol, type, size, value[x].
			let iv = Buffer.alloc(16);
			console.log("Initialize iv");
			for (let i = 0; i < 16; ++i) {
				iv[i] = 0;
			}
			console.log("Set nonce");
			for (let i = 0; i < 5; ++i) {
				iv[i+3] = nonce[i];
			}

			console.log("Set mode of operation");
			let aesCtr = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(iv));
			console.log("Fill data to be encrypted");

			// first a plain-text header
			let header = 4;
			let cmdBytes = Buffer.alloc(16 + header);
			for (let i = 0; i < 3; ++i) {
				//cmdBytes[i] = Math.floor(Math.random() * 255);
				cmdBytes[i] = iv[i];
			}
			let accessLevel = 2;
			cmdBytes[3] = accessLevel;

			// then encrypted payload
			let commandType = 20;
			let commandSize = 1;
			let dimLevel = 0;

			let encryptedPayload = Buffer.alloc(16);
			for (let i = 0; i < 16; ++i) {
				encryptedPayload[i] = 0;
			}

			for (let i = 0; i < 4; ++i) {
				encryptedPayload[i] = validation_key[i];
			}
			
			encryptedPayload[4] = protocol;
			encryptedPayload[5] = commandType;
			encryptedPayload[6] = 0;
			encryptedPayload[7] = commandSize;
			encryptedPayload[8] = 0;
			encryptedPayload[9] = dimLevel;
			console.log("Encrypt" , encryptedPayload);
			
			// cmdBytes is plain header plus encrypted bytes
			for (let i = 0; i < 16; ++i) {
				cmdBytes[i+header] = encryptedPayload[i];
			}
			console.log("Unencrypted command" , cmdBytes.toString('hex'));

			// do the actual encryption
			let encryptedBytes = aesCtr.encrypt(encryptedPayload);
		
			// cmdBytes is plain header plus encrypted bytes
			for (let i = 0; i < 16; ++i) {
				cmdBytes[i+header] = encryptedBytes[i];
			}
			console.log("Command over the wire" , cmdBytes);
			
			console.log("Command over the wire" , cmdBytes.toString('hex'));
			
			// Get the control characteristic
			console.log("Get control characteristic");
			const control_char = await service.getCharacteristic(char_control_uuid);
			
			// Write the command 
			console.log("Write value");
			//const result = 
			await control_char.writeValue(cmdBytes);

			console.log("Command sent");
			//console.log("Result", result);

			//setBatteryLevel(reading.getUint8(0) + '%');
		} catch(error) {
			console.log(`There was an error: ${error}`);
		}
	};

	return (
		<div className="App">
		<h1>Get Crownstones</h1>
		<p>
		Enable Bluetooth for your browser. This is an experimental feature which does not work in any browser!
		If enabled, you can suddenly control your devices from the browser, very cool!
		</p>
		<p>
		Note that controlling a device like this has the following benefits:
		</p>
		<ul>
		<li>You can control your devices from this <strong>website</strong>. This means that there is no <strong>app</strong> involved. You have to trust your browser rather than your smartphone operating system. Regretfully a lot of manufacturers try to pull you into their apps. We do not want to do this. You should be able to use your hardware in the way you like!
		</li>
		<li>
		You can even run a website like this locally. This means that you can use it offline, when the internet goes down, and that you do not have to trust the website's owner or the server it is running on.
		</li>
		<li>
		If Bluetooth is enabled in the browser you still have to give permission to use Bluetooth for a particular website. Compare it with an app where you have to give permission each time it runs. It might be annoying, but it's pretty safe! Browser devlopers are people that have security on top of their minds all the time!
		</li>
		<li>
		Needless to say, but you can run a "Bluetooth-enabled" browser in a container if you'd like to. Note that you
		can also directly control our devices outside of a browser.
		</li>
		</ul>
		{supportsBluetooth && !isDisconnected &&
			<p>Level: {batteryLevel}</p>
		}
		{supportsBluetooth && isDisconnected &&
				<button onClick={connectToDeviceAndSubscribeToUpdates}>Find Crownstone</button>
		}
		{!supportsBluetooth &&
				<p>This browser doesn't support the Web Bluetooth API</p>
		}
		</div>
	);
}

export default App;
