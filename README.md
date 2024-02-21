# AWS IoT fleet provisioning without device certificates

See, https://docs.aws.amazon.com/iot/latest/developerguide/provision-wo-cert.html.

### 0. Install dependencies
```bash
pnpm install
```

### 1. Create a private key and a certificate for claim certificate
```bash
aws iot create-keys-and-certificate --set-as-active > cert/create-keys-and-certificate.json
cat cert/create-keys-and-certificate.json | jq -r '.certificateArn' > cert/certificateArn.txt
cat cert/create-keys-and-certificate.json | jq -r '.certificatePem' > cert/cert.pem
cat cert/create-keys-and-certificate.json | jq -r '.keyPair.PublicKey' > cert/public.key
cat cert/create-keys-and-certificate.json | jq -r '.keyPair.PrivateKey' > cert/private.key
```

### 2. Deploy CDK
```bash
cd packages/cdk
pnpm cdk deploy -c certificateArn=$(cat ../../cert/certificateArn.txt)
```

### 3. Provisioning by TypeScript
```bash
cd packages/provisioning-node

# Create a private key and a CSR for device certificate
# See, https://docs.aws.amazon.com/ja_jp/iot/latest/developerguide/create-cert.html
openssl genrsa -out cert/privatekey.pem 2048
openssl req -new -subj "/C=JP/ST=Tokyo/L=Chiyodaku/O=MyCompany/CN=AWS IoT Certificate" -key cert/privatekey.pem -out cert/cert.csr

# Fetch Amazon Root CA1 certificate
curl https://www.amazontrust.com/repository/AmazonRootCA1.pem > cert/ca-cert.pem

# Fetch AWS IoT ATS endpoint
aws iot describe-endpoint --endpoint-type  iot:Data-ATS > cert/endpoint.json

# Start provisioning
pnpm start
```
