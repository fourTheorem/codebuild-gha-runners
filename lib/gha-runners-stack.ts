import * as cdk from 'aws-cdk-lib'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'
import { CODEBUILD_POLICY_ARN_PARAM_NAME, GITHUB_CODECONNECTION_ARN_PARAM_NAME } from './constants'

/**
 * This stack sets up CodeBuild projects to run GitHub Actions runners.
 */
export class GhaRunnersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const githubOrganisation = scope.node.tryGetContext('githuborg')
    if (!githubOrganisation) {
      throw new Error("Context variable 'githuborg' is required. This should be the name of your GitHub organisation")
    }

    const connectionArn = ssm.StringParameter.fromStringParameterName(
      this,
      'ConnectionArnParam',
      GITHUB_CODECONNECTION_ARN_PARAM_NAME
    ).stringValue
    const codeBuildPolicyArnParam = ssm.StringParameter.fromStringParameterName(
      this,
      'CodeBuildPolicyArnParam',
      CODEBUILD_POLICY_ARN_PARAM_NAME
    ).stringValue
    const projectServiceRole = new iam.Role(this, 'CodeBuildServiceRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      path: '/service-role/'
    })
    projectServiceRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(this, 'CodeBuildManagedPolicy', codeBuildPolicyArnParam)
    )

    const environmentsBySuffix: Record<string, codebuild.CfnProject.EnvironmentProperty> = {
      '': {
        computeType: 'BUILD_GENERAL1_SMALL',
        image: 'aws/codebuild/standard:5.0',
        type: 'LINUX_CONTAINER'
      },
      '-lambda': {
        computeType: 'BUILD_LAMBDA_10GB',
        image: 'aws/codebuild/amazonlinux-x86_64-lambda-standard:nodejs20',
        type: 'LINUX_LAMBDA_CONTAINER'
      }
    }

    const commonCodeBuildProjectProps: Omit<codebuild.CfnProjectProps, 'name' | 'environment'> = {
      source: {
        gitCloneDepth: 1,
        type: 'GITHUB',
        location: 'CODEBUILD_DEFAULT_WEBHOOK_SOURCE_LOCATION',
        auth: {
          // Change type to 'OAUTH' if you want to use a GitHub PAT that has already been
          // loaded into your AWS account+region with `import-source-credentials`.
          type: 'CODECONNECTIONS',
          resource: connectionArn
        }
      },
      triggers: {
        webhook: true,
        scopeConfiguration: {
          name: githubOrganisation
        },
        filterGroups: [
          [
            {
              type: 'EVENT',
              pattern: 'WORKFLOW_JOB_QUEUED'
            }
          ]
        ]
      },
      artifacts: {
        type: 'NO_ARTIFACTS'
      },
      concurrentBuildLimit: 60,
      serviceRole: projectServiceRole.roleArn
    }

    for (const [suffix, environment] of Object.entries(environmentsBySuffix)) {
      new codebuild.CfnProject(this, `RunnerProject${suffix}`, {
        ...commonCodeBuildProjectProps,
        environment: environment,
        name: `gha-runners${suffix}`
      })
    }
  }
}
