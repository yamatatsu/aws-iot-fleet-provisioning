import * as iam from "aws-cdk-lib/aws-iam";
import * as iot from "aws-cdk-lib/aws-iot";
import { Construct } from "constructs";

type Props = {
	thingPolicy: iot.CfnPolicy;
};

/**
 * @see https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/provision-wo-cert.html#claim-based
 */
export class ProvisioningTemplate extends Construct {
	readonly provisioningTemplate: iot.CfnProvisioningTemplate;

	constructor(app: Construct, id: string, props: Props) {
		super(app, id);

		/**
		 * Provisioning Template 関連付けるロール
		 * thingや証明書などの IoT リソースを作成または更新する権限を持つ。
		 */
		const provisioningRole = new iam.Role(this, "test-role-for-provisioning", {
			assumedBy: new iam.ServicePrincipal("iot.amazonaws.com"),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName(
					"service-role/AWSIoTThingsRegistration",
				),
			],
		});

		/**
		 * @see https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/provision-template.html#fleet-provision-template
		 */
		this.provisioningTemplate = new iot.CfnProvisioningTemplate(
			this,
			"ProvisioningTemplate",
			{
				enabled: true,
				// TODO: プロビジョニングの事前チェックのやつ？あとで試す。
				// preProvisioningHook?: cdk.IResolvable | CfnProvisioningTemplate.ProvisioningHookProperty,
				provisioningRoleArn: provisioningRole.roleArn,
				templateName: "MyFleetProvisioningTemplate",
				// templateType: "FLEET_PROVISIONING",
				templateBody: JSON.stringify({
					Parameters: {
						SerialNumber: { Type: "String" },
						// TODO: ドキュメントでは指定していないので、消してみる。 see https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/provision-template.html#fleet-provision-template
						// でも多分必要なんじゃないかな
						// "AWS::IoT::Certificate::Id": { Type: "String" },
					},
					Resources: {
						thing: {
							Type: "AWS::IoT::Thing",
							Properties: {
								AttributePayload: {},
								ThingGroups: [],
								ThingName: {
									"Fn::Join": ["", ["ThingPrefix_", { Ref: "SerialNumber" }]],
								},
							},
							OverrideSettings: {
								AttributePayload: "MERGE",
								ThingTypeName: "REPLACE",
								ThingGroups: "DO_NOTHING",
							},
						},
						certificate: {
							Type: "AWS::IoT::Certificate",
							Properties: {
								CertificateId: { Ref: "AWS::IoT::Certificate::Id" },
								Status: "Active",
							},
						},
						policy: {
							Type: "AWS::IoT::Policy",
							Properties: {
								PolicyName: props.thingPolicy.ref,
							},
						},
					},
				}),
			},
		);
	}
}
