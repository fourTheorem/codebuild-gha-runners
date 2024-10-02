import * as cdk from 'aws-cdk-lib'
import * as codeconn from 'aws-cdk-lib/aws-codeconnections'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'
import { CODEBUILD_POLICY_ARN_PARAM_NAME, GITHUB_CODECONNECTION_ARN_PARAM_NAME } from './constants'

/**
 * This stack provides a CodeConnection connection, allowing services like CodeBuild to connect
 * to GitHub. After creation, the connection must be manually finalised
 * in the management console before it is used. That's why we keep it in a separate stack.
 */
export class CodeConnectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Adding this policy to the same stack as the CodeBuild project
    // resulted in IAM eventual consistency problems, causing
    // the CodeConnection to be inaccessible
    // ("User is not authorized to access connection")
    // Providing it as a managed policy in a separate stack mitigates this.
    const codebuildConnectionPolicy = new iam.ManagedPolicy(this, 'CodeBuildPolicy', {
      managedPolicyName: `${cdk.Stack.of(this).stackName}CodeBuildPolicy`,
      document: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['codeconnections:Get*', 'codeconnections:List*', 'codeconnections:Pass*', 'codeconnections:Use*'],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'codebuild:ListConnectedOAuthAccounts',
              'codebuild:ListRepositories',
              'codebuild:PersistOAuthToken',
              'codebuild:ImportSourceCredentials'
            ],
            resources: ['*']
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: ['*']
          })
        ]
      })
    })

    const conn = new codeconn.CfnConnection(this, 'Conn', {
      connectionName: 'GitHubFt',
      providerType: 'GitHub'
    })

    new ssm.StringParameter(this, 'CodeBuildPolicyArnParam', {
      parameterName: CODEBUILD_POLICY_ARN_PARAM_NAME,
      stringValue: codebuildConnectionPolicy.managedPolicyArn,
      description: 'Managed policy for CodeBuild allowing CodeConnection usage'
    })
    new ssm.StringParameter(this, 'ConnectionArnParam', {
      parameterName: GITHUB_CODECONNECTION_ARN_PARAM_NAME,
      stringValue: conn.attrConnectionArn,
      description: 'CodeConnection connection ARN for access to GitHub from'
    })
  }
}
