import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Runtime, Architecture, Function, Code, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import { ApplicationListenerRule, ApplicationTargetGroup, ApplicationListener, ListenerCondition, ListenerAction } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import * as path from 'path';

export class ProductPageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const staticBucketArn = StringParameter.valueFromLookup(this, 's3StaticBucketArn');

    const staticBucket = Bucket.fromBucketArn(this, 'mfe-static-assets', cdk.Lazy.string({ produce: () => staticBucketArn }));

    new BucketDeployment(this, 'DeployStatic', {
      sources: [Source.asset(path.join(
        __dirname,
        '../app/.next/',
        'static'))
      ],
      destinationBucket: staticBucket,
      destinationKeyPrefix: '_next/static',
    });

    new BucketDeployment(this, 'DeployPublic', {
      sources: [Source.asset(path.join(
        __dirname,
        '../app/public'))
      ],
      destinationBucket: staticBucket,
      destinationKeyPrefix: 'public',
    });

    const productPageFunc = new Function(this, 'product-page', {
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.X86_64,
      handler: 'run.sh',
      code: Code.fromAsset(path.join(
        __dirname,
        '../app/.next/',
        'standalone')
      ),
      environment: {
        "AWS_LAMBDA_EXEC_WRAPPER": "/opt/bootstrap",
        "RUST_LOG": "info",
        "PORT": "8000"
      },
      layers: [
        LayerVersion.fromLayerVersionArn(this, 'web-adapter', `arn:aws:lambda:${process.env.CDK_DEFAULT_REGION}:753240598075:layer:LambdaAdapterLayerX86:22`)
      ]
    });

    const listener = ApplicationListener.fromLookup(this, 'Listener', {
      loadBalancerArn: StringParameter.valueFromLookup(this, 'loadBalancerArn'),
      listenerPort: 80
    })

    const productTarget = new ApplicationTargetGroup(this, 'product-target', {
      targets: [new targets.LambdaTarget(productPageFunc)],
    });

    const pathConditionProduct = ListenerCondition.pathPatterns(['/product*']);

    const productRule = new ApplicationListenerRule(this, 'product-rule', {
      listener: listener,
      priority: 101,
      conditions: [pathConditionProduct],
      action: ListenerAction.forward([productTarget])
    });
  }
}
