import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { Vpc, SecurityGroup, Peer, Port, FlowLog, FlowLogResourceType } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancer, ListenerAction } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CloudFrontWebDistribution, OriginAccessIdentity, CloudFrontAllowedMethods, CloudFrontAllowedCachedMethods, OriginProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';

import { prefixList } from '../utils/prefixList'
import { ConfigProps } from "./config";

type AwsEnvStackProps = StackProps & {
  config: Readonly<ConfigProps>;
};

export class MfeRouterStack extends Stack {

  constructor(scope: Construct, id: string, props?: AwsEnvStackProps) {
    super(scope, id, props);

    // --------  S3 Buckets ------------
    const accesslogsBucket = process.env.ACCESS_LOGS_BUCKET
      ? Bucket.fromBucketName(this, "access-logs-bucket", process.env.ACCESS_LOGS_BUCKET)
      : undefined;

    const albLogBucket = process.env.ENABLE_ALB_LOGS
      ? new Bucket(this, 'alb-access-logs-bucket', {
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true,
        serverAccessLogsBucket: accesslogsBucket,
        serverAccessLogsPrefix: "alb-logs",
        encryption: BucketEncryption.S3_MANAGED,
        removalPolicy: RemovalPolicy.DESTROY
      })
      : undefined;

    const sourceBucket = new Bucket(this, 'mfe-static-assets', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      serverAccessLogsBucket: accesslogsBucket,
      serverAccessLogsPrefix: "s3-logs",
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
    });

    new StringParameter(this, 's3StaticBucketArn', {
      stringValue: sourceBucket.bucketArn,
      description: "S3 Static Assets Bucket arn",
      parameterName: 's3StaticBucketArn'
    })

    // --------  mfe-router-NETWORKING ------------  
    const vpc = new Vpc(this, "mfe-router-vpc", {
      maxAzs: 3,
    });

    if (process.env.ENABLE_FLOW_LOGS === "true") {
      new FlowLog(this, 'FlowLog', {
        resourceType: FlowLogResourceType.fromVpc(vpc),
      });
    } 

    const albSG = new SecurityGroup(this, 'alb-sg', {
      vpc: vpc,
      allowAllOutbound: true,
      description: 'alb-sg'
    })

    const PREFIX_GLOBAL_CF = prefixList[process.env.CDK_DEFAULT_REGION as string]
    albSG.addIngressRule(Peer.prefixList(PREFIX_GLOBAL_CF), Port.tcp(80), 'allow ingress from CF')

    const loadBalancer = new ApplicationLoadBalancer(this, 'load-balancer', {
      vpc: vpc,
      internetFacing: true,
      securityGroup: albSG
    });

    if (process.env.ENABLE_ALB_LOGS === "true") {
      loadBalancer.logAccessLogs(albLogBucket as IBucket, 'alb-logs');
    }


    // --------  ALB LISTENER ------------ 

    const listener = loadBalancer.addListener('Listener', {
      port: 80,
      open: false,
      defaultAction: ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'Default response from ALB!'
      })
    });

    new StringParameter(this, 'loadBalancerArn', {
      stringValue: loadBalancer.loadBalancerArn,
      description: "Load Balancer ARN",
      parameterName: 'loadBalancerArn'
    })

    // --------  CF distro ------------    

    const oai = new OriginAccessIdentity(this, 'mfe-oai')
    let loggingConfiguration;
    if (accesslogsBucket !== undefined) {
      loggingConfiguration = {
        bucket: accesslogsBucket,
        includeCookies: false,
      };
    }

    const distribution = new CloudFrontWebDistribution(this, 'mfe-distro', {
      loggingConfig: loggingConfiguration,
      originConfigs: [
        {

          s3OriginSource: {
            s3BucketSource: sourceBucket,
            originAccessIdentity: oai
          },
          behaviors: [
            {
              pathPattern: '/_next/*',
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
              cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD
            },
            {
              pathPattern: '/public/*',
              allowedMethods: CloudFrontAllowedMethods.GET_HEAD,
              cachedMethods: CloudFrontAllowedCachedMethods.GET_HEAD
            }
          ],
        },
        {
          customOriginSource: {
            domainName: loadBalancer.loadBalancerDnsName,
            originProtocolPolicy: OriginProtocolPolicy.HTTP_ONLY,
          },
          behaviors: [
            {
              isDefaultBehavior: true,
              allowedMethods: CloudFrontAllowedMethods.ALL,
              forwardedValues: {
                queryString: true,
                cookies: {
                  forward: 'all'
                },
                headers: ['*'],
              }
            }
          ]
        }
      ],
    });

    // --------  OUTPUTS ------------

    new CfnOutput(this, 'distributionDomainName', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'the URL to access the website in a browser',
      exportName: 'website-url'
    });
  }
}
