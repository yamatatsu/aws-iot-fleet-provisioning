import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { mqtt } from "aws-iot-device-sdk-v2";
import createConnection from "./createConnection";

const DEVICE_CERT_PATH = `${__dirname}/../cert/cert.pem`;
const decoder = new TextDecoder("utf8");

let certificatePem: string | null = null;
let certificateOwnershipToken: string | null = null;
let provisioned = false;

main();

async function main() {
	const csr = readFileSync(`${__dirname}/../cert/cert.csr`, "utf8");

	const connection = await createConnection();

	await connection.connect();

	if (existsSync(DEVICE_CERT_PATH)) {
		console.info("Cert already exists");
	} else {
		// subscribe

		await startToSubscribe(connection);

		// publish

		await connection.publish(
			"$aws/certificates/create-from-csr/json",
			{ certificateSigningRequest: csr },
			mqtt.QoS.AtLeastOnce,
		);
		console.info("[create-cert] Published");

		await waitFor(() => certificateOwnershipToken !== null);

		await connection.publish(
			"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json",
			{
				certificateOwnershipToken: certificateOwnershipToken,
				parameters: {
					// TODO: これを preProvisioningHook とかで使うのかな。
					SerialNumber: randomUUID(),
				},
			},
			mqtt.QoS.AtLeastOnce,
		);
		console.info("[provisioning] Published");

		await waitFor(() => provisioned);

		if (certificatePem) {
			writeFileSync(DEVICE_CERT_PATH, certificatePem);
			console.info("[provisioning] Saved cert");
		} else {
			console.warn("[provisioning] cert is not in result");
		}
	}

	await connection.disconnect();
}

async function startToSubscribe(connection: mqtt.MqttClientConnection) {
	await connection.subscribe(
		"$aws/certificates/create-from-csr/json/accepted",
		mqtt.QoS.AtLeastOnce,
		(topic, payload, dup, qos, retain) => {
			console.log(
				`[create-cert] Success. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
			);
			const resultOfCreateCert = JSON.parse(decoder.decode(payload));
			certificateOwnershipToken = resultOfCreateCert.certificateOwnershipToken;
			certificatePem = resultOfCreateCert.certificatePem;
		},
	);
	await connection.subscribe(
		"$aws/certificates/create-from-csr/json/rejected",
		mqtt.QoS.AtLeastOnce,
		(topic, payload, dup, qos, retain) => {
			console.log(
				`[create-cert] Failure. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
			);
			const message = decoder.decode(payload);
			console.error(message);
		},
	);
	console.info("[create-cert] Subscribing");
	await connection.subscribe(
		"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json/accepted",
		mqtt.QoS.AtLeastOnce,
		(topic, payload, dup, qos, retain) => {
			console.log(
				`[provisioning] Success. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
			);
			const resultOfProvisioning = JSON.parse(decoder.decode(payload));
			console.info("[provisioning] payload", { resultOfProvisioning });
			provisioned = true;
		},
	);
	await connection.subscribe(
		"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json/rejected",
		mqtt.QoS.AtLeastOnce,
		(topic, payload, dup, qos, retain) => {
			console.log(
				`[provisioning] Failure. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
			);
			const message = decoder.decode(payload);
			console.error(message);
		},
	);
	console.info("[provisioning] Subscribing");
}

async function waitFor(fn: () => boolean, retryTimeout = 5, interval = 1000) {
	for (const attemptCount of Array(retryTimeout).keys()) {
		if (attemptCount > 0) {
			await setTimeout(interval);
		}
		if (fn()) {
			return;
		}
	}
}
