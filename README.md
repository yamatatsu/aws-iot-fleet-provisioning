# AWS IoT fleet provisioning without device certificates

See, https://docs.aws.amazon.com/iot/latest/developerguide/provision-wo-cert.html.

### 0. Install dependencies
```bash
pnpm install
```

### 1. Create a private key and a certificate for provisioning template
```bash
aws iot create-keys-and-certificate --set-as-active > cert/create-keys-and-certificate.json
cat cert/create-keys-and-certificate.json | jq -r '.certificateArn' > cert/certificateArn.txt
```

### 2. Deploy CDK
```bash
cd packages/cdk
pnpm cdk deploy -c certificateArn=$(cat ../../cert/certificateArn.txt)
```
