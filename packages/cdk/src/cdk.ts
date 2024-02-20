import * as cdk from "aws-cdk-lib";
import * as iot from "aws-cdk-lib/aws-iot";
import { ProvisioningTemplate } from "./ProvisioningTemplate";

/**
 * @see https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/provision-wo-cert.html#claim-based
 */

const app = new cdk.App();
const stack = new cdk.Stack(app, "FleetProvisioning", {});

const certificateArn = app.node.getContext("certificateArn");

/**
 * Fleet Provisioningによって証明書を作成する際に証明書にアタッチされるポリシー
 */
const thingPolicy = new iot.CfnPolicy(stack, "ThingPolicy", {
	policyDocument: {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				// TODO: デバイスができることを制限する
				Action: "iot:Publish",
				Resource: "arn:aws:iot:us-east-1:123456789012:topic/foo/bar",
			},
		],
	},
});

const { provisioningTemplate } = new ProvisioningTemplate(
	stack,
	"ProvisioningTemplate",
	{ thingPolicy },
);

// デバイスに予め埋め込んでおくクレーム証明書のポリシー
const claimPolicy = new iot.CfnPolicy(stack, "ClaimPolicy", {
	policyDocument: {
		Version: "2012-10-17",
		Statement: [
			{
				Effect: "Allow",
				Action: ["iot:Connect"],
				Resource: ["*"],
			},
			{
				Effect: "Allow",
				Action: ["iot:Publish", "iot:Receive"],
				Resource: [
					`arn:aws:iot:${stack.region}:${stack.account}:topic/$aws/certificates/create/*`,
					`arn:aws:iot:${stack.region}:${stack.account}:topic/$aws/provisioning-templates/${provisioningTemplate.ref}/provision/*`,
				],
			},
			{
				Effect: "Allow",
				Action: ["iot:Subscribe"],
				Resource: [
					`arn:aws:iot:${stack.region}:${stack.account}:topicfilter/$aws/certificates/create/*`,
					`arn:aws:iot:${stack.region}:${stack.account}:topicfilter/$aws/provisioning-templates/${provisioningTemplate.ref}/provision/*`,
				],
			},
		],
	},
});

if (certificateArn) {
	new iot.CfnPolicyPrincipalAttachment(stack, "ClaimPolicyAttachment", {
		policyName: claimPolicy.ref,
		principal: certificateArn,
	});
}
