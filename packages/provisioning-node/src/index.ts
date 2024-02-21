import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mqtt } from "aws-iot-device-sdk-v2";
import createConnection from "./createConnection";

const DEVICE_CERT_PATH = `${__dirname}/../cert/cert.pem`;

const decoder = new TextDecoder("utf8");

main();

async function main() {
	const csr = readFileSync(`${__dirname}/../cert/cert.csr`, "utf8");

	const connection = await createConnection();

	await connection.connect();

	if (!existsSync(DEVICE_CERT_PATH)) {
		const { resultPromise: resultPromiseOfCreateFromCsr } =
			await subscribeOnce<{
				certificateOwnershipToken: "string";
				certificateId: "string";
				certificatePem: "string";
			}>(
				connection,
				"$aws/certificates/create-from-csr/json/accepted",
				"$aws/certificates/create-from-csr/json/rejected",
			);

		console.info("[create-cert] Subscribing");

		await connection.publish(
			"$aws/certificates/create-from-csr/json",
			{ certificateSigningRequest: csr },
			mqtt.QoS.AtLeastOnce,
		);

		console.info("[create-cert] Published");

		const resultOfCreateFromCsr = await resultPromiseOfCreateFromCsr;
		console.info("[create-cert] Success");

		const { resultPromise } = await subscribeOnce<{ thingName: "string" }>(
			connection,
			"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json/accepted",
			"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json/rejected",
		);

		console.info("[provisioning] Subscribing");

		await connection.publish(
			"$aws/provisioning-templates/MyFleetProvisioningTemplate/provision/json",
			{
				certificateOwnershipToken:
					resultOfCreateFromCsr.certificateOwnershipToken,
				parameters: {
					// TODO: これを preProvisioningHook とかで使うのかな。
					SerialNumber: randomUUID(),
				},
			},
			mqtt.QoS.AtLeastOnce,
		);

		console.info("[provisioning] Published");

		const result = await resultPromise;
		console.info("[provisioning] Success", { result });

		writeFileSync(DEVICE_CERT_PATH, resultOfCreateFromCsr.certificatePem);
		console.info("[provisioning] Saved cert");
	}

	await connection.disconnect();
}

async function subscribeOnce<T>(
	connection: mqtt.MqttClientConnection,
	successTopic: string,
	failureTopic: string,
): Promise<{ resultPromise: Promise<T> }> {
	const subscribePromises: Promise<unknown>[] = [];

	const resultPromise = new Promise<T>((resolve, reject) => {
		subscribePromises.push(
			connection.subscribe(
				successTopic,
				mqtt.QoS.AtLeastOnce,
				(topic, payload, dup, qos, retain) => {
					console.log(
						`Success. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
					);
					resolve(JSON.parse(decoder.decode(payload)));
				},
			),
		);

		subscribePromises.push(
			connection.subscribe(
				failureTopic,
				mqtt.QoS.AtLeastOnce,
				(topic, payload, dup, qos, retain) => {
					console.log(
						`Failure. topic:"${topic}" dup:${dup} qos:${qos} retain:${retain}`,
					);
					const message = decoder.decode(payload);
					console.error(message);
					reject(message);
				},
			),
		);
	});

	await Promise.all(subscribePromises);

	return { resultPromise };
}
