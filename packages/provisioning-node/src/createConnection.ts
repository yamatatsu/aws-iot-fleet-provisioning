import { randomUUID } from "node:crypto";
import { io, iot, mqtt } from "aws-iot-device-sdk-v2";

const CLAIM_CERT_PATH = `${__dirname}/../../../cert/cert.pem`;
const CLAIM_KEY_PATH = `${__dirname}/../../../cert/private.key`;
const CA_CERT_PATH = `${__dirname}/../cert/ca-cert.pem`;

export default async function createConnection(): Promise<mqtt.MqttClientConnection> {
	const endpointJson = await import("../cert/endpoint.json");

	const config = createConfig({ endpoint: endpointJson.endpointAddress });
	const client = createClient();
	const connection = client.new_connection(config);

	return connection;
}

function createConfig(props: {
	endpoint: string;
}) {
	const configBuilder =
		iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
			CLAIM_CERT_PATH,
			CLAIM_KEY_PATH,
		);

	configBuilder.with_certificate_authority_from_path(undefined, CA_CERT_PATH);

	configBuilder.with_clean_session(false);
	configBuilder.with_client_id(`test-${randomUUID()}`);
	configBuilder.with_endpoint(props.endpoint);

	const config = configBuilder.build();

	return config;
}

function createClient() {
	const level: io.LogLevel = io.LogLevel.INFO;
	io.enable_logging(level);

	const clientBootstrap = new io.ClientBootstrap();

	const client = new mqtt.MqttClient(clientBootstrap);
	return client;
}
