import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Runtime, Function, Code, LayerVersion, Architecture } from 'aws-cdk-lib/aws-lambda';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import { ApplicationListenerRule, ApplicationTargetGroup, ApplicationListener, ListenerCondition, ListenerAction } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import * as path from 'path';

export class HomePageStack extends cdk.Stack {
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

    const homePageFunc = new Function(this, 'home-page', {
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

    // --------  ALB TARGETS + RULES ------------ 

    const homeTarget = new ApplicationTargetGroup(this, 'home-target', {
      targets: [new targets.LambdaTarget(homePageFunc)]
    });

    const pathConditionHome = ListenerCondition.pathPatterns(['/home*']);

    const homeRule = new ApplicationListenerRule(this, 'home-rule', {
      listener: listener,
      priority: 100,
      conditions: [pathConditionHome],
      action: ListenerAction.forward([homeTarget])
    });
  }
}
